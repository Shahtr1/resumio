import { HttpClient } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  title = signal('Resumio Upload');

  selectedFile: File | null = null;
  chunkSize = 5 * 1024 * 1024; // 5MB

  uploadId: string | null = null;
  totalChunks: number = 0;

  constructor(private http: HttpClient) {}

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
    console.log('File selected:', this.selectedFile);
  }

  splitFile() {
    if (!this.selectedFile) {
      console.log('No file selected');
      return;
    }

    const chunks = this.createChunks(this.selectedFile);
    console.log('Chunks:', chunks);
  }

  createChunks(file: File) {
    const chunks = [];
    let start = 0;
    let index = 0;

    while (start < file.size) {
      const end = Math.min(start + this.chunkSize, file.size);
      const blob = file.slice(start, end);

      chunks.push({
        index,
        blob,
      });

      start = end;
      index++;
    }

    return chunks;
  }

  initUpload() {
    if (!this.selectedFile) return;

    const body = {
      fileName: this.selectedFile.name,
      fileSize: this.selectedFile.size,
    };

    this.http.post<any>('http://localhost:8080/upload/init', body).subscribe({
      next: (res) => {
        console.log('Upload initialized:', res);

        // store for later
        this.uploadId = res.uploadId;
        this.chunkSize = res.chunkSize;
        this.totalChunks = res.totalChunks;
      },
      error: (err) => {
        console.error('Init failed:', err);
      },
    });
  }

  async sha256(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  uploadChunk(chunk: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this.uploadId) return reject();

      const hash = await this.sha256(chunk.blob);

      const headers = {
        uploadId: this.uploadId!,
        chunkIndex: chunk.index.toString(),
        chunkHash: hash,
      };

      this.http.put('http://localhost:8080/upload/chunk', chunk.blob, { headers }).subscribe({
        next: () => {
          console.log(`Chunk ${chunk.index} uploaded`);
          resolve();
        },
        error: (err) => {
          console.error(`Chunk ${chunk.index} failed`, err);
          reject(err);
        },
      });
    });
  }

  async uploadAllChunks() {
    if (!this.selectedFile) return;

    const chunks = this.createChunks(this.selectedFile);

    for (const chunk of chunks) {
      await this.uploadChunk(chunk);
    }
  }

  async completeUpload() {
    if (!this.selectedFile || !this.uploadId) return;

    console.log('Calculating file hash...');

    const fileHash = await this.sha256(this.selectedFile);

    console.log('File hash:', fileHash);

    this.http
      .post(
        `http://localhost:8080/upload/complete?uploadId=${this.uploadId}&fileHash=${fileHash}`,
        {},
      )
      .subscribe({
        next: () => {
          console.log('Upload completed successfully');
        },
        error: (err) => {
          console.error('Complete failed', err);
        },
      });
  }
}
