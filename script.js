// ========================================
// CONFIGURAÇÕES GERAIS
// ========================================

const WHATSAPP_NUMBER = '5511948773263';
const PERSONAL_NAME = 'Italo Ruan';

// ========================================
// MENU HAMBURGER
// ========================================

const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
    });

    // Fechar menu ao clicar em um link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });

    // Fechar menu ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.navbar-container')) {
            navMenu.classList.remove('active');
            hamburger.classList.remove('active');
        }
    });
}

// ========================================
// SCROLL SUAVE
// ========================================

function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Prevenir comportamento padrão de links âncora
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const targetId = href.substring(1);
            scrollToSection(targetId);
        }
    });
});

// ========================================
// EFEITO DE SCROLL NA NAVBAR
// ========================================

let lastScrollTop = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', function() {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > 100) {
        navbar.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
    } else {
        navbar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
    }
    
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
});

// ========================================
// ANIMAÇÕES AO SCROLL
// ========================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observar elementos de treino
document.querySelectorAll('.training-card, .stat-box, .benefit-item, .qual-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// ========================================
// CONTADOR DE ESTATÍSTICAS
// ========================================

function animateCounter(element, target, duration = 2000) {
    let current = 0;
    const increment = target / (duration / 16);
    const originalText = element.textContent;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target + '+';
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current) + '+';
        }
    }, 16);
}

// Animar contadores quando visíveis
const statBoxes = document.querySelectorAll('.stat-box h4');
let statsAnimated = false;

const statsObserver = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting && !statsAnimated) {
            statsAnimated = true;
            statBoxes.forEach(box => {
                const number = parseInt(box.textContent);
                if (!isNaN(number)) {
                    animateCounter(box, number);
                }
            });
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statsSection = document.querySelector('.sobre-stats');
if (statsSection) {
    statsObserver.observe(statsSection);
}

// ========================================
// INTEGRAÇÃO WHATSAPP
// ========================================

function sendWhatsAppMessage(message = '') {
    const defaultMessage = `Olá ${PERSONAL_NAME}! Gostaria de saber mais sobre seus treinos personalizados.`;
    const finalMessage = message || defaultMessage;
    const encodedMessage = encodeURIComponent(finalMessage);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
}

// Adicionar funcionalidade aos botões WhatsApp
document.querySelectorAll('.btn-whatsapp').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        sendWhatsAppMessage();
    });
});

// ========================================
// EFEITO DE HOVER NOS CARDS
// ========================================

document.querySelectorAll('.training-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-8px)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

// ========================================
// VALIDAÇÃO E FEEDBACK
// ========================================

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log(`%c${PERSONAL_NAME} - Personal Trainer`, 'color: #1e40af; font-size: 16px; font-weight: bold;');
    console.log('Site carregado com sucesso!');
    
    // Verificar suporte a recursos
    if (!navigator.onLine) {
        showNotification('Você está offline. Alguns recursos podem não estar disponíveis.', 'warning');
    }
});

// ========================================
// FUNÇÕES UTILITÁRIAS
// ========================================

// Função para copiar texto
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copiado para a área de transferência!');
    }).catch(() => {
        showNotification('Erro ao copiar', 'error');
    });
}

// Função para formatar telefone
function formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
}

// ========================================
// ANALYTICS E TRACKING
// ========================================

// Rastrear cliques em botões
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const buttonText = this.textContent.trim();
        console.log(`Botão clicado: ${buttonText}`);
    });
});

// ========================================
// SUPORTE A TEMAS
// ========================================

// Detectar preferência de tema do sistema
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    console.log('Tema escuro detectado no sistema');
}

// ========================================
// SERVICE WORKER (Opcional)
// ========================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Descomentar para ativar service worker
        // navigator.serviceWorker.register('/sw.js');
    });
}

// ========================================
// MELHORIAS DE PERFORMANCE
// ========================================

// Lazy loading de imagens
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('loaded');
                imageObserver.unobserve(img);
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// ========================================
// EVENTOS PERSONALIZADOS
// ========================================

// Evento customizado para quando o usuário interage com CTA
const ctaEvent = new CustomEvent('ctaInteraction', {
    detail: { timestamp: new Date(), action: 'whatsapp' }
});

document.querySelectorAll('.btn-whatsapp, .btn-primary, .btn-secondary').forEach(btn => {
    btn.addEventListener('click', function() {
        document.dispatchEvent(ctaEvent);
    });
});

// Listener para o evento customizado
document.addEventListener('ctaInteraction', function(e) {
    console.log('CTA interação detectada:', e.detail);
});
