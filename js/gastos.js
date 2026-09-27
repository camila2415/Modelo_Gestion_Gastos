document.addEventListener('DOMContentLoaded', () => {
    
    const usuarioActivo = JSON.parse(localStorage.getItem('usuarioActivo'));
    if (!usuarioActivo) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('userEmailDisplay').textContent = usuarioActivo.email;

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
    
    const modalConfirmar = document.getElementById('modalConfirmar');
    const btnAceptarEliminar = document.getElementById('btnAceptarEliminar');
    const btnCancelarEliminar = document.getElementById('btnCancelarEliminar');
    let idParaEliminar = null;

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

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('usuarioActivo');
            window.location.href = 'index.html';
        });
    }

    function obtenerGastos() {
        return JSON.parse(localStorage.getItem('gastos_sgg')) || [];
    }

    function guardarGastos(gastos) {
        localStorage.setItem('gastos_sgg', JSON.stringify(gastos));
    }

    function renderizar() {
        const todosLosGastos = obtenerGastos();
        
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
            const index = gastos.findIndex(g => g.id == idActual);
            if (index !== -1) {
                gastos[index].monto = montoVal;
                gastos[index].fecha = inputFecha.value;
                gastos[index].categoria = selectCategoria.value;
                gastos[index].descripcion = inputDescripcion.value;
            }
        } else {
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

    window.solicitarEliminacion = function(id) {
        idParaEliminar = id;
        modalConfirmar.style.display = 'block';
    };

    btnCancelarEliminar.addEventListener('click', () => {
        idParaEliminar = null;
        modalConfirmar.style.display = 'none';
    });

    btnAceptarEliminar.addEventListener('click', () => {
        if (idParaEliminar) {
            const gastos = obtenerGastos();
            const index = gastos.findIndex(g => g.id == idParaEliminar);
            if (index !== -1) {

                gastos[index].estado_activo = false;
                guardarGastos(gastos);
            }
        }
        idParaEliminar = null;
        modalConfirmar.style.display = 'none';
        renderizar();
    });

    renderizar();
});