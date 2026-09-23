package com.dietapp;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.Pagination;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PaginationTest {
    @Test
    void defaultAndMaximumPageSizeAreBounded() {
        assertThat(Pagination.DEFAULT_SIZE).isLessThanOrEqualTo(Pagination.MAX_SIZE);
        assertThat(Pagination.request(0, Pagination.DEFAULT_SIZE).getPageSize())
                .isEqualTo(Pagination.DEFAULT_SIZE);
        assertThatThrownBy(() -> Pagination.request(0, Pagination.MAX_SIZE + 1))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void negativePagesAndZeroSizeAreRejected() {
        assertThatThrownBy(() -> Pagination.request(-1, 1))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> Pagination.request(0, 0))
                .isInstanceOf(BadRequestException.class);
    }
}
