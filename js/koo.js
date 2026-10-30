/* ==========================================================================
   MÓDULO GLOBAL: AUTENTICACIÓN, TEMAS Y API REST (js/koo.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------------------------------------------------
    // 1. AUTENTICACIÓN Y INICIO DE SESIÓN SIN RECARGA DE PÁGINA
    // ----------------------------------------------------------------------
    // Recupera la sesión activa o asigna 'chopper@gmail.com' por defecto si no existe
    let usuarioGuardado = localStorage.getItem('sgg_usuario_activo');
    if (!usuarioGuardado) {
        usuarioGuardado = 'chopper@gmail.com';
        localStorage.setItem('sgg_usuario_activo', usuarioGuardado);
    }

    const userEmailDisplay = document.getElementById('userEmailDisplay');
    if (userEmailDisplay) {
        userEmailDisplay.textContent = usuarioGuardado;
    }

    // Capturar cualquier formulario de login o registro en index.html
    const formLogin = document.querySelector('form:not(#formGasto)');
    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault(); // Detiene el refresco nativo del navegador

            const emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
            
            const userEmail = (emailInput && emailInput.value.trim() !== '') 
                ? emailInput.value.trim().toLowerCase() 
                : 'chopper@gmail.com';

            // Guardar identificador para aislar la base SQLite en OPFS
            localStorage.setItem('sgg_usuario_activo', userEmail);

            // Redirección controlada al dashboard
            window.location.href = 'dashboard.html';
        });
    }

    // ----------------------------------------------------------------------
    // 2. MODO DÍA / NOCHE Y TEMAS VISUALES
    // ----------------------------------------------------------------------
    const aplicarTemaYModo = () => {
        const temaEstilo = localStorage.getItem('sgg_tema_estilo') || 'one-piece';
        const modoLuz = localStorage.getItem('sgg_modo_luz') || 'light';

        document.body.setAttribute('data-tema', temaEstilo);
        document.body.setAttribute('data-modo', modoLuz);

        if (temaEstilo === 'one-piece') {
            document.body.classList.add('one-piece-theme');
        } else {
            document.body.classList.remove('one-piece-theme');
        }

        if (modoLuz === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }

        const selectTema = document.getElementById('selectTemaEstilo');
        if (selectTema) selectTema.value = temaEstilo;

        window.dispatchEvent(new Event('cambioTemaModo'));
    };

    aplicarTemaYModo();

    const selectTema = document.getElementById('selectTemaEstilo');
    if (selectTema) {
        selectTema.addEventListener('change', (e) => {
            localStorage.setItem('sgg_tema_estilo', e.target.value);
            aplicarTemaYModo();
        });
    }

    const btnTema = document.getElementById('btnTemaModo') || document.getElementById('btnTema');
    if (btnTema) {
        btnTema.addEventListener('click', () => {
            const modoActual = document.body.getAttribute('data-modo') || 'light';
            const nuevoModo = modoActual === 'light' ? 'dark' : 'light';

            localStorage.setItem('sgg_modo_luz', nuevoModo);
            aplicarTemaYModo();
        });
    }

    // ----------------------------------------------------------------------
    // 3. CONSUMO ASINCRÓNICO API REST EXTERNA (DÓLAR EN TIEMPO REAL)
    // ----------------------------------------------------------------------
    const obtenerCotizacionDolar = async () => {
        const dolarEl = document.getElementById('dolarDisplay');
        if (!dolarEl) return;

        try {
            const respuesta = await fetch('https://dolarapi.com/v1/dolares/oficial');
            if (!respuesta.ok) throw new Error('Error HTTP al consultar API');
            
            const datos = await respuesta.json();
            dolarEl.textContent = `💵 USD Oficial: $${datos.venta}`;
        } catch (error) {
            console.error('Manejo de resiliencia API Dólar:', error);
            dolarEl.textContent = '💵 USD Oficial: N/A';
        }
    };

    obtenerCotizacionDolar();
});

/* ==========================================================================
   GESTIÓN DE AUTENTICACIÓN Y VISIBILIDAD DE CONTRASEÑA (LOGIN)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // Selector del campo de contraseña y del botón
    const inputPass = document.getElementById('password') || document.querySelector('input[type="password"]');
    const btnToggle = document.getElementById('btnMostrarPassword') || document.getElementById('togglePassword') || document.querySelector('.mostrar-contrasena');

    if (btnToggle && inputPass) {
        btnToggle.addEventListener('click', (e) => {
            e.preventDefault();
            
            const esPassword = inputPass.type === 'password';
            
            // Alternar visibilidad del input
            inputPass.type = esPassword ? 'text' : 'password';
            
            // Actualizar texto e icono del botón
            btnToggle.innerHTML = esPassword ? 'Ocultar contraseña' : '👁️ Mostrar contraseña';
        });
    }

});