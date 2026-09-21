package com.dietapp.water;

import com.dietapp.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "water_checks")
public class WaterCheck {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "amount_ml", nullable = false)
    private int amountMl;

    @Column(name = "check_date", nullable = false)
    private LocalDate checkDate;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected WaterCheck() {}

    public WaterCheck(User user, int amountMl, LocalDate checkDate) {
        this.id = UUID.randomUUID();
        this.user = user;
        this.amountMl = amountMl;
        this.checkDate = checkDate;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public int getAmountMl() { return amountMl; }
    public LocalDate getCheckDate() { return checkDate; }
    public Instant getCreatedAt() { return createdAt; }
}
