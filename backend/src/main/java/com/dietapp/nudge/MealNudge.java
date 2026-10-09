package com.dietapp.nudge;

import com.dietapp.diet.Diet;
import com.dietapp.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "meal_nudges")
public class MealNudge {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "diet_id", nullable = false)
    private Diet diet;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    @Enumerated(EnumType.STRING)
    @Column(name = "meal_type", nullable = false, length = 32)
    private MealNudgeType mealType;

    @Column(name = "meal_date", nullable = false)
    private LocalDate mealDate;

    @Column(name = "message_key", nullable = false, length = 40)
    private String messageKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    protected MealNudge() {}

    public MealNudge(Diet diet, User sender, User recipient, MealNudgeType mealType,
                     LocalDate mealDate, Instant createdAt) {
        this.id = UUID.randomUUID();
        this.diet = diet;
        this.sender = sender;
        this.recipient = recipient;
        this.mealType = mealType;
        this.mealDate = mealDate;
        this.messageKey = mealType.messageKey();
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public Diet getDiet() { return diet; }
    public User getSender() { return sender; }
    public User getRecipient() { return recipient; }
    public MealNudgeType getMealType() { return mealType; }
    public LocalDate getMealDate() { return mealDate; }
    public String getMessageKey() { return messageKey; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }

    public void markRead(Instant instant) {
        if (readAt == null) readAt = instant;
    }
}
