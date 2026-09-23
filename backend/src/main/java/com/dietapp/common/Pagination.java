package com.dietapp.common;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;

public final class Pagination {
    public static final int DEFAULT_SIZE = 50;
    public static final int MAX_SIZE = 100;

    private Pagination() {}

    public static Pageable request(int page, int size) {
        if (page < 0) throw new BadRequestException("page must be zero or greater");
        if (size < 1 || size > MAX_SIZE) {
            throw new BadRequestException("size must be between 1 and " + MAX_SIZE);
        }
        return PageRequest.of(page, size);
    }

    public static <T> ResponseEntity.BodyBuilder headers(ResponseEntity.BodyBuilder builder, Page<T> page) {
        return builder.header("X-Page", Integer.toString(page.getNumber()))
                .header("X-Page-Size", Integer.toString(page.getSize()))
                .header("X-Total-Count", Long.toString(page.getTotalElements()))
                .header("X-Has-Next", Boolean.toString(page.hasNext()));
    }
}
