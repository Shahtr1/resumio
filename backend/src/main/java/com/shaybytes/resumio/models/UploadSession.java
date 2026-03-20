package com.shaybytes.resumio.models;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UploadSession {
    private String uploadId;
    private String fileName;
    private int totalChunks;
    private long chunkSize;
    private String status; // INIT, IN_PROGRESS, COMPLETED
}
