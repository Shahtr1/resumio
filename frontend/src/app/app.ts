import { HttpClient } from '@angular/common/http';
import { Component, computed, signal } from '@angular/core';

type UploadStageId =
  | 'idle'
  | 'preparing'
  | 'initializing'
  | 'uploading'
  | 'finalizing'
  | 'completed';

type UploadStage = {
  id: UploadStageId;
  label: string;
  description: string;
  details: string[];
};

type Chunk = {
  index: number;
  blob: Blob;
};

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly title = 'Resumio Upload';
  readonly subtitle =
    'Upload a file once and let the app handle chunking, transfer, and completion while keeping the user informed.';
  readonly chunkSize = signal(5 * 1024 * 1024);
  readonly selectedFile = signal<File | null>(null);
  readonly uploadId = signal<string | null>(null);
  readonly totalChunks = signal(0);
  readonly uploadedChunks = signal(0);
  readonly activeStage = signal<UploadStageId>('idle');
  readonly expandedStage = signal<UploadStageId | null>('preparing');
  readonly stageMessage = signal('Choose a file to begin.');
  readonly isUploading = signal(false);
  readonly errorMessage = signal('');

  readonly stages: UploadStage[] = [
    {
      id: 'preparing',
      label: 'Prepare file',
      description:
        'The file is measured and split into smaller parts so the upload stays reliable.',
      details: [
        'Your file is divided into manageable pieces before anything is sent.',
        'This makes large uploads smoother and easier to resume if something interrupts the process.',
        'The app calculates how many pieces are needed so the next steps can be planned clearly.',
      ],
    },
    {
      id: 'initializing',
      label: 'Reserve upload',
      description: 'The server opens a secure upload session and prepares a place for the file.',
      details: [
        'A unique upload ID is created so every file has its own tracked session.',
        'The backend records how many chunks to expect and the file name being uploaded.',
        'This lets the server keep progress organized while the transfer is happening.',
      ],
    },
    {
      id: 'uploading',
      label: 'Transfer chunks',
      description: 'Each chunk is uploaded one by one and checked before it is accepted.',
      details: [
        'Every piece is fingerprinted so the server can confirm it arrived correctly.',
        'Uploaded chunks are tracked, which helps avoid duplicate work and supports recovery.',
        'The server stores each accepted part until the full file is ready to be assembled.',
      ],
    },
    {
      id: 'finalizing',
      label: 'Verify and finish',
      description: 'The backend rebuilds the final file and verifies that nothing was corrupted.',
      details: [
        'Once all chunks arrive, the backend combines them back into the original file.',
        'A final file check confirms the rebuilt file matches what was selected on your device.',
        'Temporary chunk data is cleaned up after a successful completion.',
      ],
    },
    {
      id: 'completed',
      label: 'Ready',
      description: 'The file is uploaded and the flow is complete.',
      details: [
        'The completed file is now available on the server.',
        'Upload tracking is marked as finished and temporary upload data is cleared away.',
        'From the user perspective, this is the end of the upload journey.',
      ],
    },
  ];

  readonly selectedFileName = computed(() => this.selectedFile()?.name ?? 'No file selected');
  readonly selectedFileSize = computed(() => this.formatBytes(this.selectedFile()?.size ?? 0));
  readonly progressPercentage = computed(() => {
    const total = this.totalChunks();
    if (!total) {
      return this.activeStage() === 'completed' ? 100 : 0;
    }

    return Math.round((this.uploadedChunks() / total) * 100);
  });

  readonly completedStageCount = computed(() => {
    const stageOrder: UploadStageId[] = [
      'idle',
      'preparing',
      'initializing',
      'uploading',
      'finalizing',
      'completed',
    ];
    const currentIndex = stageOrder.indexOf(this.activeStage());

    return Math.max(currentIndex - 1, 0);
  });

  constructor(private http: HttpClient) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.selectedFile.set(file);
    this.resetUploadState();

    if (file) {
      this.expandedStage.set('preparing');
      this.stageMessage.set(`Selected ${file.name}. Ready to upload.`);
    }
  }

  async startUpload() {
    const file = this.selectedFile();
    if (!file || this.isUploading()) {
      return;
    }

    this.resetUploadState();
    this.isUploading.set(true);
    this.errorMessage.set('');

    try {
      this.activeStage.set('preparing');
      this.expandedStage.set('preparing');
      this.stageMessage.set('Preparing file and calculating chunk plan...');
      const initialChunks = this.createChunks(file, this.chunkSize());
      this.totalChunks.set(initialChunks.length);

      this.activeStage.set('initializing');
      this.expandedStage.set('initializing');
      this.stageMessage.set('Creating an upload session...');
      const initResponse = await this.initUpload(file);

      this.uploadId.set(initResponse.uploadId);
      this.chunkSize.set(initResponse.chunkSize);
      this.totalChunks.set(initResponse.totalChunks);

      const chunks = this.createChunks(file, initResponse.chunkSize);

      this.activeStage.set('uploading');
      this.expandedStage.set('uploading');
      this.stageMessage.set('Uploading chunks and validating each part...');
      for (const chunk of chunks) {
        await this.uploadChunk(chunk);
        this.uploadedChunks.set(chunk.index + 1);
        this.stageMessage.set(
          `Uploaded chunk ${chunk.index + 1} of ${chunks.length}. Processing continues...`,
        );
      }

      this.activeStage.set('finalizing');
      this.expandedStage.set('finalizing');
      this.stageMessage.set('Finalizing upload and verifying the full file hash...');
      await this.completeUpload(file);

      this.activeStage.set('completed');
      this.expandedStage.set('completed');
      this.stageMessage.set('Upload completed successfully. Your file is ready.');
    } catch (error) {
      console.error(error);
      this.errorMessage.set('Upload failed. Please try again.');
      this.stageMessage.set('Something went wrong while processing the file.');
    } finally {
      this.isUploading.set(false);
    }
  }

  private resetUploadState() {
    this.uploadId.set(null);
    this.totalChunks.set(0);
    this.uploadedChunks.set(0);
    this.activeStage.set('idle');
    this.errorMessage.set('');
  }

  private createChunks(file: File, chunkSize: number): Chunk[] {
    const chunks: Chunk[] = [];
    let start = 0;
    let index = 0;

    while (start < file.size) {
      const end = Math.min(start + chunkSize, file.size);
      chunks.push({
        index,
        blob: file.slice(start, end),
      });

      start = end;
      index++;
    }

    return chunks;
  }

  private initUpload(
    file: File,
  ): Promise<{ uploadId: string; chunkSize: number; totalChunks: number }> {
    return new Promise((resolve, reject) => {
      this.http
        .post<{ uploadId: string; chunkSize: number; totalChunks: number }>('/upload/init', {
          fileName: file.name,
          fileSize: file.size,
        })
        .subscribe({
          next: (response) => resolve(response),
          error: (error) => reject(error),
        });
    });
  }

  private async sha256(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private uploadChunk(chunk: Chunk): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const uploadId = this.uploadId();

      if (!uploadId) {
        reject(new Error('Upload session not initialized.'));
        return;
      }

      try {
        const hash = await this.sha256(chunk.blob);

        this.http
          .put('/upload/chunk', chunk.blob, {
            headers: {
              uploadId,
              chunkIndex: chunk.index.toString(),
              chunkHash: hash,
            },
          })
          .subscribe({
            next: () => resolve(),
            error: (error) => reject(error),
          });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async completeUpload(file: File): Promise<void> {
    const uploadId = this.uploadId();
    if (!uploadId) {
      throw new Error('Missing upload session.');
    }

    const fileHash = await this.sha256(file);

    return new Promise((resolve, reject) => {
      this.http
        .post(
          `/upload/complete?uploadId=${uploadId}&fileHash=${fileHash}`,
          {},
          {
            responseType: 'text',
          },
        )
        .subscribe({
          next: () => resolve(),
          error: (error) => reject(error),
        });
    });
  }

  formatBytes(bytes: number) {
    if (!bytes) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** unitIndex;

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  getStageState(stageId: UploadStageId) {
    if (this.activeStage() === 'idle') {
      return 'pending';
    }

    const orderedStages = this.stages.map((stage) => stage.id);
    const currentIndex = orderedStages.indexOf(this.activeStage());
    const stageIndex = orderedStages.indexOf(stageId);

    if (stageId === this.activeStage()) {
      return 'active';
    }

    if (currentIndex > stageIndex || this.activeStage() === 'completed') {
      return 'complete';
    }

    return 'pending';
  }

  toggleStage(stageId: UploadStageId) {
    this.expandedStage.set(this.expandedStage() === stageId ? null : stageId);
  }
}
