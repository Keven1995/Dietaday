package com.dietapp.comment;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CommentResponse(UUID id, UUID mealId, UUID authorId, String authorName,
                              String content, Instant createdAt, Instant updatedAt,
                              List<CommentReactionSummary> reactions) {
    static CommentResponse from(MealComment comment, List<CommentReactionSummary> reactions) {
        return new CommentResponse(comment.getId(), comment.getMeal().getId(),
                comment.getAuthor().getId(), comment.getAuthor().getFullName(), comment.getContent(),
                comment.getCreatedAt(), comment.getUpdatedAt(), reactions);
    }
}
