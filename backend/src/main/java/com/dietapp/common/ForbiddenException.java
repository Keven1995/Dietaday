package com.dietapp.common;

public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) { super(message); }
}
