package com.shaybytes.resumio.controllers;

import com.shaybytes.resumio.models.InitRequest;
import com.shaybytes.resumio.models.UploadSession;
import com.shaybytes.resumio.models.UploadStatus;
import com.shaybytes.resumio.services.UploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/upload")
@RequiredArgsConstructor
public class UploadController {

    private final UploadService uploadService;

    @PostMapping("/init")
    public UploadSession init(@RequestBody InitRequest request) {
        return uploadService.initUpload(request);
    }

    @PutMapping("/chunk")
    public ResponseEntity<?> uploadChunk(
            @RequestHeader String uploadId,
            @RequestHeader int chunkIndex,
            @RequestHeader String chunkHash,
            @RequestBody byte[] chunkData) {

        uploadService.saveChunk(uploadId, chunkIndex, chunkHash, chunkData);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/status/{uploadId}")
    public UploadStatus status(@PathVariable String uploadId) {
        return uploadService.getStatus(uploadId);
    }

    @PostMapping("/complete")
    public ResponseEntity<String> complete(
            @RequestParam String uploadId,
            @RequestParam String fileHash) {

        uploadService.completeUpload(uploadId, fileHash);
        return ResponseEntity.ok("Upload completed");
    }
}