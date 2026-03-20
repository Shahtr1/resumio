package com.shaybytes.resumio.models;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;
import java.util.Set;

@Data
@AllArgsConstructor
public class UploadStatus {
    private Set<Integer> uploadedChunks;
    private List<Integer> missingChunks;
}