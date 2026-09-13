package com.dietapp.comment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CommentReactionRepository extends JpaRepository<CommentReaction, UUID> {
    Optional<CommentReaction> findByCommentIdAndUserId(UUID commentId, UUID userId);

    @Query("select new com.dietapp.comment.CommentReactionCount(r.comment.id, r.emoji, count(r), " +
            "sum(case when r.user.id = :userId then 1 else 0 end)) from CommentReaction r " +
            "where r.comment.id in :commentIds group by r.comment.id, r.emoji")
    List<CommentReactionCount> summarize(@Param("commentIds") Collection<UUID> commentIds,
                                          @Param("userId") UUID userId);
}
