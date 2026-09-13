package com.dietapp.comment;

import java.util.UUID;

public record CommentReactionCount(UUID commentId, String emoji, long count, long currentUserCount) {}
