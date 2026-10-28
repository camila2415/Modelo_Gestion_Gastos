/* ==========================================================================
   MÓDULO DE AUTENTICACIÓN Y SESIÓN DE USUARIO (SGG - GRAND LINE)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------------------------------------------------
    // 1. MANEJO DEL FORMULARIO DE INICIO DE SESIÓN
    // ----------------------------------------------------------------------
    const formLogin = document.querySelector('form');

    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();

            // Búsqueda flexible del campo email
            const emailInput = document.getElementById('email') 
                || document.querySelector('input[type="email"]') 
                || document.querySelector('input[name="email"]');

            const passwordInput = document.getElementById('password') 
                || document.querySelector('input[type="password"]') 
                || document.querySelector('input[name="password"]');

            const userEmail = (emailInput && emailInput.value.trim() !== '') 
                ? emailInput.value.trim() 
                : 'cami1524@gmail.com';

            // Guardar la sesión del usuario activo en localStorage
            localStorage.setItem('sgg_usuario_activo', userEmail);

            // Redirección inmediata al dashboard
            window.location.href = 'dashboard.html';
        });
    }

    // ----------------------------------------------------------------------
    // 2. TOGGLE DE MOSTRAR / OCULTAR CONTRASEÑA
    // ----------------------------------------------------------------------
    const togglePasswordBtn = document.getElementById('togglePassword') 
        || Array.from(document.querySelectorAll('a, button, span')).find(el => el.textContent.includes('Mostrar contraseña') || el.textContent.includes('Ocultar contraseña'));
    
    const passwordInput = document.getElementById('password') 
        || document.querySelector('input[type="password"]');

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const esPassword = passwordInput.type === 'password';
            passwordInput.type = esPassword ? 'text' : 'password';
            
            togglePasswordBtn.textContent = esPassword 
                ? '👁️ Ocultar contraseña' 
                : '👁️ Mostrar contraseña';
        });
    }

    // ----------------------------------------------------------------------
    // 3. CONTROL DE TEMA (MODO SOL / NOCHE)
    // ----------------------------------------------------------------------
    const btnTema = document.getElementById('btnTema');
    const temaGuardado = localStorage.getItem('sgg_tema');

    if (temaGuardado === 'dark') {
        document.body.classList.add('dark-mode');
    }

    if (btnTema) {
        btnTema.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const esOscuro = document.body.classList.contains('dark-mode');
            localStorage.setItem('sgg_tema', esOscuro ? 'dark' : 'light');
        });
    }
});