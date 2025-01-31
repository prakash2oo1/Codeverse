// Page Navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
    });
    
    document.getElementById(pageId).classList.add('active');
    document.querySelector(`[data-page="${pageId.replace('-page', '')}"]`).classList.add('active');
}

function navigateToTranslate() {
    showPage('translate-page');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = `${e.target.dataset.page}-page`;
            showPage(pageId);
        });
    });

    // Initialize toast
    window.showToast = (message, duration = 3000) => {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, duration);
    };

    // Handle copy button
    document.getElementById('copy-code').addEventListener('click', () => {
        const code = window.targetEditor.getValue();
        navigator.clipboard.writeText(code).then(() => {
            showToast('Code copied to clipboard!');
        }).catch(() => {
            showToast('Failed to copy code');
        });
    });
});
