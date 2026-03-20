package com.shaybytes.resumio.utils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;

public final class HashUtil {

    private static final String SHA_256 = "SHA-256";
    private static final HexFormat HEX_FORMAT = HexFormat.of();

    private HashUtil() {
    }

    public static String sha256(byte[] data) {
        try {
            return hash(data);
        } catch (Exception e) {
            throw new RuntimeException("Error calculating hash", e);
        }
    }

    public static String sha256File(Path path) {
        try {
            return hash(Files.readAllBytes(path));
        } catch (IOException e) {
            throw new RuntimeException("Error reading file for hash calculation", e);
        } catch (Exception e) {
            throw new RuntimeException("Error calculating file hash", e);
        }
    }

    private static String hash(byte[] data) throws Exception {
        MessageDigest digest = MessageDigest.getInstance(SHA_256);
        return HEX_FORMAT.formatHex(digest.digest(data));
    }
}
