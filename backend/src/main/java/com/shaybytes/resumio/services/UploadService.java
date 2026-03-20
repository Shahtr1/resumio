package com.shaybytes.resumio.services;

import com.shaybytes.resumio.models.*;

public interface UploadService {

    UploadSession initUpload(InitRequest request);

    void saveChunk(String uploadId, int chunkIndex,String chunkHash, byte[] data);

    UploadStatus getStatus(String uploadId);

    void completeUpload(String uploadId, String fileHash);
}