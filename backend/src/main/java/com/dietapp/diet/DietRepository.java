package com.dietapp.diet;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DietRepository extends JpaRepository<Diet, UUID> {
    @Query("select d from Diet d join DietMember m on m.diet = d where m.user.id = :userId order by d.startDate desc")
    List<Diet> findAllForUser(@Param("userId") UUID userId);
}
