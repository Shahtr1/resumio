package com.shaybytes.resumio.models;

import lombok.Data;

@Data
public class InitRequest {
    private String fileName;
    private long fileSize;
}