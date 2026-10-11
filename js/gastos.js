document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Verificación de sesión activa (RF-01)
    const usuarioActivo = JSON.parse(localStorage.getItem('usuarioActivo'));
    if (!usuarioActivo) {
        window.location.href = 'index.html';
        return; 
    }

    document.getElementById('userEmailDisplay').textContent = usuarioActivo.email;

    // 2. Captura de elementos del DOM
    const formGasto = document.getElementById('formGasto');
    const inputId = document.getElementById('gastoId');
    const inputMonto = document.getElementById('monto');
    const inputFecha = document.getElementById('fecha');
    const selectCategoria = document.getElementById('categoria');
    const inputDescripcion = document.getElementById('descripcion');
    const tablaBody = document.getElementById('tablaGastosBody');
    const totalDisplay = document.getElementById('totalGastado');
    const btnLogout = document.getElementById('btnLogout');
    const btnTema = document.getElementById('btnTema');
    
    // Elementos para el Modal de Confirmación (RF-08)
    const modalConfirmar = document.getElementById('modalConfirmar');
    const btnAceptarEliminar = document.getElementById('btnAceptarEliminar');
    const btnCancelarEliminar = document.getElementById('btnCancelarEliminar');
    let idParaEliminar = null;

    // 3. Manejo de Tema Claro/Oscuro (RF-02)
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }
    if (btnTema) {
        btnTema.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const esOscuro = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', esOscuro ? 'dark' : 'light');
        });
    }

    // 4. Cierre de sesión (Logout)
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('usuarioActivo');
            window.location.href = 'index.html';
        });
    }

    // 5. Funciones auxiliares para LocalStorage
    function obtenerGastos() {
        return JSON.parse(localStorage.getItem('gastos_sgg')) || [];
    }

    function guardarGastos(gastos) {
        localStorage.setItem('gastos_sgg', JSON.stringify(gastos));
    }

    // 6. Renderizado de Tabla e Historial con Filtro de Baja Lógica (RF-06 y RF-09)
    function renderizar() {
        const todosLosGastos = obtenerGastos();
        
        // Filtrar por el usuario en sesión Y por estado_activo === true (Baja lógica)
        const gastosVisibles = todosLosGastos.filter(g => 
            g.email_usuario === usuarioActivo.email && g.estado_activo === true
        );

        tablaBody.innerHTML = '';
        let totalAcumulado = 0;

        gastosVisibles.forEach(gasto => {
            totalAcumulado += parseFloat(gasto.monto);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${gasto.fecha}</td>
                <td>${gasto.categoria}</td>
                <td>${gasto.descripcion}</td>
                <td>$${parseFloat(gasto.monto).toFixed(2)}</td>
                <td>
                    <button class="btn-edit" onclick="prepararEdicion(${gasto.id})">Editar</button>
                    <button class="btn-delete" onclick="solicitarEliminacion(${gasto.id})">Eliminar</button>
                </td>
            `;
            tablaBody.appendChild(tr);
        });

        totalDisplay.textContent = totalAcumulado.toFixed(2);
    }

    // 7. Evento Submit: Crear (RF-05) o Actualizar (RF-07)
    formGasto.addEventListener('submit', (e) => {
        e.preventDefault();
        const montoVal = parseFloat(inputMonto.value);

        if (montoVal <= 0 || isNaN(montoVal)) {
            alert('El monto debe ser un número mayor a cero.');
            return;
        }

        const gastos = obtenerGastos();
        const idActual = inputId.value;

        if (idActual) {
            // Edición de un gasto existente
            const index = gastos.findIndex(g => g.id == idActual);
            if (index !== -1) {
                gastos[index].monto = montoVal;
                gastos[index].fecha = inputFecha.value;
                gastos[index].categoria = selectCategoria.value;
                gastos[index].descripcion = inputDescripcion.value;
            }
        } else {
            // Creación de un nuevo gasto con objeto completo
            const nuevoGasto = {
                id: Date.now(),
                email_usuario: usuarioActivo.email,
                monto: montoVal,
                fecha: inputFecha.value,
                categoria: selectCategoria.value,
                descripcion: inputDescripcion.value,
                estado_activo: true 
            };
            gastos.push(nuevoGasto);
        }

        guardarGastos(gastos);
        formGasto.reset();
        inputId.value = '';
        document.getElementById('btnGuardar').textContent = 'Guardar Gasto';
        renderizar();
    });

    // 8. Cargar datos en el formulario para editar (RF-07)
    window.prepararEdicion = function(id) {
        const gastos = obtenerGastos();
        const gasto = gastos.find(g => g.id == id);
        if (gasto) {
            inputId.value = gasto.id;
            inputMonto.value = gasto.monto;
            inputFecha.value = gasto.fecha;
            selectCategoria.value = gasto.categoria;
            inputDescripcion.value = gasto.descripcion;
            document.getElementById('btnGuardar').textContent = 'Actualizar Gasto';
        }
    };

    // 9. Solicitar eliminación abriendo el modal (RF-08)
    window.solicitarEliminacion = function(id) {
        idParaEliminar = id;
        modalConfirmar.style.display = 'block';
    };

    // Botón Cancelar en el modal
    btnCancelarEliminar.addEventListener('click', () => {
        idParaEliminar = null;
        modalConfirmar.style.display = 'none';
    });

    // Botón Aceptar en el modal (Aplica la Baja Lógica cambiando estado_activo)
    btnAceptarEliminar.addEventListener('click', () => {
        if (idParaEliminar) {
            const gastos = obtenerGastos();
            const index = gastos.findIndex(g => g.id == idParaEliminar);
            if (index !== -1) {
                gastos[index].estado_activo = false; // Baja lógica
                guardarGastos(gastos);
            }
        }
        idParaEliminar = null;
        modalConfirmar.style.display = 'none';
        renderizar();
    });

    // Carga inicial al entrar a la página
    renderizar();
});