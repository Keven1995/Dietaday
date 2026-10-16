package com.dietapp.invitation;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.http.ResponseEntity;
import com.dietapp.common.Pagination;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class InvitationController {
    private final InvitationService service;
    private final DietInvitationLinkService links;

    public InvitationController(InvitationService service, DietInvitationLinkService links) {
        this.service = service;
        this.links = links;
    }

    @PostMapping("/diets/{dietId}/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public InvitationResponse create(@PathVariable UUID dietId,
                                     @Valid @RequestBody CreateInvitationRequest request) {
        return InvitationResponse.from(service.create(dietId, request.email()));
    }

    @GetMapping("/invitations")
    public ResponseEntity<List<InvitationResponse>> listPending(@RequestParam(defaultValue = "0") int page,
                                                                @RequestParam(defaultValue = "50") int size) {
        var result = service.listPending(Pagination.request(page, size));
        return Pagination.headers(ResponseEntity.ok(), result).body(result.getContent().stream()
                .map(InvitationResponse::from).toList());
    }

    @PostMapping("/invitations/{id}/accept")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void accept(@PathVariable UUID id) {
        service.accept(id);
    }

    @PostMapping("/invitations/{id}/decline")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void decline(@PathVariable UUID id) {
        service.decline(id);
    }

    @PostMapping("/diets/{dietId}/invitation-link")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedDietInvitationLink createLink(@PathVariable UUID dietId) {
        return links.create(dietId);
    }

    @DeleteMapping("/diets/{dietId}/invitation-link")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeLink(@PathVariable UUID dietId) {
        links.revoke(dietId);
    }

    @GetMapping("/invitation-links/{token}")
    public DietInvitationLinkPreview previewLink(@PathVariable String token) {
        return links.preview(token);
    }

    @PostMapping("/invitation-links/{token}/accept")
    public DietInvitationLinkAccepted acceptLink(@PathVariable String token) {
        return new DietInvitationLinkAccepted(links.accept(token));
    }

    public record DietInvitationLinkAccepted(UUID dietId) {}
}
