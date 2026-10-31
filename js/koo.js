document.addEventListener('DOMContentLoaded', () => {

    let usuarioGuardado = localStorage.getItem('sgg_usuario_activo');
    if (!usuarioGuardado) {
        usuarioGuardado = 'chopper@gmail.com';
        localStorage.setItem('sgg_usuario_activo', usuarioGuardado);
    }

    const userEmailDisplay = document.getElementById('userEmailDisplay');
    if (userEmailDisplay) {
        userEmailDisplay.textContent = usuarioGuardado;
    }

    const formLogin = document.querySelector('form:not(#formGasto)');
    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault(); 

            const emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
            
            const userEmail = (emailInput && emailInput.value.trim() !== '') 
                ? emailInput.value.trim().toLowerCase() 
                : 'chopper@gmail.com';

            localStorage.setItem('sgg_usuario_activo', userEmail);

            window.location.href = 'dashboard.html';
        });
    }

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

document.addEventListener('DOMContentLoaded', () => {

    const inputPass = document.getElementById('password') || document.querySelector('input[type="password"]');
    const btnToggle = document.getElementById('btnMostrarPassword') || document.getElementById('togglePassword') || document.querySelector('.mostrar-contrasena');

    if (btnToggle && inputPass) {
        btnToggle.addEventListener('click', (e) => {
            e.preventDefault();
            
            const esPassword = inputPass.type === 'password';
            
            inputPass.type = esPassword ? 'text' : 'password';
        
            btnToggle.innerHTML = esPassword ? 'Ocultar contraseña' : '👁️ Mostrar contraseña';
        });
    }

});