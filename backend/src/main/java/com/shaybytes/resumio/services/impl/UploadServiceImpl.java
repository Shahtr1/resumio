package com.shaybytes.resumio.services.impl;

import com.shaybytes.resumio.models.InitRequest;
import com.shaybytes.resumio.models.UploadSession;
import com.shaybytes.resumio.models.UploadStatus;
import com.shaybytes.resumio.services.UploadService;
import com.shaybytes.resumio.utils.HashUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UploadServiceImpl implements UploadService {

    private static final long CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

    private final RedisTemplate<String, Object> redisTemplate;

    // Temporary in-memory storage (replace with DB later)
    private final Map<String, UploadSession> sessions = new HashMap<>();

    @Override
    public UploadSession initUpload(InitRequest request) {
        String uploadId = UUID.randomUUID().toString();
        int totalChunks = (int) Math.ceil((double) request.getFileSize() / CHUNK_SIZE);

        UploadSession session = new UploadSession(
                uploadId,
                request.getFileName(),
                totalChunks,
                CHUNK_SIZE,
                "INIT"
        );

        sessions.put(uploadId, session);
        return session;
    }

    @Override
    public void saveChunk(String uploadId, int chunkIndex, String chunkHash, byte[] data) {
        String redisKey = "upload:" + uploadId;

        if (Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(redisKey, chunkIndex))) {
            return;
        }

        String calculatedHash = HashUtil.sha256(data);
        if (!calculatedHash.equals(chunkHash)) {
            throw new RuntimeException("Chunk hash mismatch - possible corruption");
        }

        Path path = Paths.get("uploads", uploadId, String.valueOf(chunkIndex));

        try {
            Files.createDirectories(path.getParent());
            Files.write(path, data);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        redisTemplate.opsForSet().add(redisKey, chunkIndex);

        String chunkHashKey = "chunk:" + uploadId + ":" + chunkIndex;
        redisTemplate.opsForValue().set(chunkHashKey, chunkHash);
    }

    @Override
    public UploadStatus getStatus(String uploadId) {
        UploadSession session = sessions.get(uploadId);

        Set<Object> uploaded = redisTemplate.opsForSet().members("upload:" + uploadId);
        Set<Integer> uploadedSet = uploaded == null
                ? new HashSet<>()
                : uploaded.stream()
                .map(o -> Integer.parseInt(o.toString()))
                .collect(Collectors.toSet());

        List<Integer> missing = new ArrayList<>();
        for (int i = 0; i < session.getTotalChunks(); i++) {
            if (!uploadedSet.contains(i)) {
                missing.add(i);
            }
        }

        return new UploadStatus(uploadedSet, missing);
    }

    @Override
    public void completeUpload(String uploadId, String fileHash) {

        // 1. Validate session
        UploadSession session = sessions.get(uploadId);
        if (session == null) {
            throw new RuntimeException("Invalid uploadId");
        }

        // 2. Validate all chunks uploaded
        String redisKey = "upload:" + uploadId;
        Set<Object> uploaded = redisTemplate.opsForSet().members(redisKey);

        if (uploaded == null || uploaded.size() != session.getTotalChunks()) {
            throw new RuntimeException("Upload incomplete");
        }

        Path finalFilePath = Paths.get("uploads", uploadId, session.getFileName());

        // 3. Merge chunks (streaming)
        try {
            Files.createDirectories(finalFilePath.getParent());

            try (OutputStream outputStream = Files.newOutputStream(
                    finalFilePath,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE
            )) {
                for (int i = 0; i < session.getTotalChunks(); i++) {

                    Path chunkPath = Paths.get("uploads", uploadId, String.valueOf(i));

                    if (!Files.exists(chunkPath)) {
                        throw new RuntimeException("Missing chunk: " + i);
                    }

                    Files.copy(chunkPath, outputStream);
                }
            }

        } catch (IOException e) {
            throw new RuntimeException("Failed to assemble file", e);
        }

        // 4. Verify final file integrity
        String calculatedFileHash = HashUtil.sha256File(finalFilePath);

        if (!calculatedFileHash.equals(fileHash)) {
            try {
                Files.deleteIfExists(finalFilePath); // ❗ delete corrupted file
            } catch (IOException ignored) {}
            throw new RuntimeException("Final file corrupted");
        }

        // 5. Mark completed
        session.setStatus("COMPLETED");

        // 6. Cleanup resources
        cleanup(uploadId, session);
    }

    private void cleanup(String uploadId, UploadSession session) {

        // Delete chunk files
        for (int i = 0; i < session.getTotalChunks(); i++) {
            Path chunkPath = Paths.get("uploads", uploadId, String.valueOf(i));

            try {
                Files.deleteIfExists(chunkPath);
            } catch (IOException e) {
                throw new RuntimeException("Failed to delete chunk " + i, e);
            }
        }

        // Remove Redis tracking set
        redisTemplate.delete("upload:" + uploadId);

        // Remove chunk hashes
        for (int i = 0; i < session.getTotalChunks(); i++) {
            redisTemplate.delete("chunk:" + uploadId + ":" + i);
        }

        // Delete upload directory (if empty)
        try {
            Files.deleteIfExists(Paths.get("uploads", uploadId));
        } catch (IOException ignored) {}
    }
}
