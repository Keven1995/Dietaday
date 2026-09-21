package com.dietapp.water;

import com.dietapp.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "water_reminder_deliveries", uniqueConstraints = @UniqueConstraint(
        name = "uq_water_reminder_delivery", columnNames = {"user_id", "reminder_date", "reminder_slot"}))
public class WaterReminderDelivery {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(name = "reminder_date", nullable = false)
    private LocalDate reminderDate;
    @Column(name = "reminder_slot", nullable = false, length = 5)
    private String reminderSlot;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;
    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;

    protected WaterReminderDelivery() {}

    public WaterReminderDelivery(User user, LocalDate reminderDate, String reminderSlot, String message) {
        this.id = UUID.randomUUID();
        this.user = user;
        this.reminderDate = reminderDate;
        this.reminderSlot = reminderSlot;
        this.message = message;
        this.sentAt = Instant.now();
    }
}
