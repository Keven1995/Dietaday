package com.dietapp.auth;

import com.dietapp.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class AccountEmailService {
    private static final Logger log = LoggerFactory.getLogger(AccountEmailService.class);
    private final JavaMailSender mailSender;
    private final boolean enabled;
    private final String from;
    private final String frontendUrl;

    public AccountEmailService(JavaMailSender mailSender,
                               @Value("${app.mail.enabled:false}") boolean enabled,
                               @Value("${app.mail.from:no-reply@dietaday.com.br}") String from,
                               @Value("${app.frontend-url}") String frontendUrl) {
        this.mailSender = mailSender;
        this.enabled = enabled;
        this.from = from;
        this.frontendUrl = frontendUrl.split(",")[0].trim();
    }

    public void sendVerification(User user, String token) {
        send(user, "Confirme seu e-mail no Dietaday",
                "Olá, " + user.getFullName() + ".\n\nConfirme seu e-mail acessando:\n"
                        + frontendUrl + "/verificar-email?token=" + token + "\n\nEste link expira em 24 horas.");
    }

    public void sendPasswordReset(User user, String token) {
        send(user, "Redefinição de senha do Dietaday",
                "Olá, " + user.getFullName() + ".\n\nRedefina sua senha acessando:\n"
                        + frontendUrl + "/redefinir-senha?token=" + token + "\n\nEste link expira em 30 minutos.");
    }

    private void send(User user, String subject, String text) {
        if (!enabled) {
            log.warn("account_email_disabled type={} userId={}", subject.contains("senha") ? "password_reset" : "verification", user.getId());
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(user.getEmail());
        message.setSubject(subject);
        message.setText(text);
        mailSender.send(message);
    }
}
