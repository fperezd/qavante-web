/**
 * Borrador de demostración. No es asesoría legal ni un contrato vigente.
 * Debe ser revisado por abogado de Qavante antes de usarse en producción.
 */

export function ConexionBancariaLegalDoc() {
  return (
    <article className="rounded-2xl border border-neutral-light/80 bg-white px-8 py-10 shadow-sm">
      <p className="text-xs font-semibold tracking-[0.14em] text-brand-primary uppercase">
        Borrador de demostración · Versión 0.1 · septiembre 2026
      </p>
      <h1 className="mt-3 text-3xl leading-tight font-semibold text-neutral-dark">
        Términos y Condiciones y Política de Privacidad de la conexión bancaria
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-mid">
        Documento placeholder para la demo de Qavante. Resume lo que un texto de consentimiento de
        Open Finance en Chile suele cubrir (Ley N° 21.521, normativa CMF del Sistema de Finanzas
        Abiertas, Ley N° 19.628 y principios de la Ley N° 21.719).{" "}
        <strong className="font-semibold text-neutral-dark">No produce efectos jurídicos</strong>{" "}
        hasta que un abogado lo redacte, numere y publique como versión vigente.
      </p>

      <div className="mt-6 rounded-xl border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        Al pulsar Continuar en el widget de conexión, el usuario de la empresa acepta este borrador
        solo para efectos de la demostración. En producción, Qavante debe registrar fecha, versión,
        identidad del otorgante y el texto exacto mostrado.
      </div>

      <nav className="mt-8 rounded-xl bg-[#F5F7FA] px-5 py-4 text-sm">
        <p className="font-semibold text-neutral-dark">Contenido</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-neutral-mid">
          <li>
            <a className="hover:text-brand-primary" href="#condiciones">
              Términos y condiciones de la conexión
            </a>
          </li>
          <li>
            <a className="hover:text-brand-primary" href="#privacidad">
              Política de privacidad y tratamiento de datos
            </a>
          </li>
          <li>
            <a className="hover:text-brand-primary" href="#revocacion">
              Revocación y ejercicio de derechos
            </a>
          </li>
        </ol>
      </nav>

      <section
        id="condiciones"
        className="mt-12 scroll-mt-8 space-y-5 text-sm leading-7 text-neutral-dark"
      >
        <h2 className="text-2xl font-semibold">
          1. Términos y condiciones de la conexión bancaria
        </h2>

        <h3 className="text-lg font-semibold">1.1. Partes</h3>
        <p>
          Estos términos regulan la conexión de cuentas bancarias de la empresa titular (el
          “Titular”) a la plataforma Qavante, operada por Qavante SpA, RUT por definir, domicilio en
          Chile (“Qavante”). Qavante actúa como prestador de un servicio de información financiera /
          iniciación de lectura de datos de tesorería. El acceso técnico a las instituciones
          financieras chilenas se realiza a través de Fintoc SpA (“Fintoc”), que opera como
          proveedor tecnológico e intermediario de agregación. El banco o institución financiera
          seleccionada es el proveedor de la información de las cuentas.
        </p>
        <p>
          [PLACEHOLDER: razón social, RUT, domicilio, correo de contacto y datos de Fintoc como
          encargado de tratamiento. Completar con los contratos de servicio vigentes.]
        </p>

        <h3 className="text-lg font-semibold">1.2. Objeto y naturaleza del servicio</h3>
        <p>
          El servicio consiste en leer, de forma automática y periódica, información de cuentas,
          saldos y movimientos de las instituciones que el Titular seleccione, para mostrarlos en
          Qavante (Banco, Caja, conciliación, clasificación, proyección y reportes de gestión). El
          acceso es de <strong>solo lectura</strong>. Qavante no inicia transferencias, no ejecuta
          pagos, no modifica mandatos, no contrata productos y no opera sobre los fondos del
          Titular.
        </p>

        <h3 className="text-lg font-semibold">1.3. Consentimiento (Ley N° 21.521 y SFA)</h3>
        <p>
          Conforme a la Ley Fintech y a las normas del Sistema de Finanzas Abiertas de la CMF, el
          acceso a información financiera de un cliente exige un consentimiento que sea, como
          mínimo:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Previo:</strong> se otorga antes de establecer la conexión y de la primera
            lectura de datos.
          </li>
          <li>
            <strong>Libre:</strong> no está condicionado a contratar otro producto ajeno al servicio
            de tesorería descrito, ni se obtiene por engaño o presión.
          </li>
          <li>
            <strong>Informado:</strong> el Titular conoce quién accede, qué datos, para qué, por
            cuánto tiempo, con quién se comparte y cómo se revoca.
          </li>
          <li>
            <strong>Expreso:</strong> se manifiesta con una acción afirmativa (Continuar / Conectar)
            sobre este texto, no por omisión ni casillas premarcadas.
          </li>
          <li>
            <strong>Específico:</strong> cubre únicamente las instituciones, productos y finalidades
            aquí descritas. Un banco adicional o una finalidad nueva requiere un nuevo
            consentimiento.
          </li>
        </ul>
        <p>
          Quien acepta declara tener facultades suficientes para representar a la empresa Titular
          (apoderado, administrador o usuario autorizado en Qavante).
        </p>

        <h3 className="text-lg font-semibold">1.4. Datos a los que se accede</h3>
        <p>Con el consentimiento, Qavante podrá leer, a través de Fintoc:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Identidad de la institución y del titular de la cuenta (nombre, RUT, tipo).</li>
          <li>
            Identificación de productos: cuentas corrientes, cuentas vista, líneas y, cuando el
            banco lo permita, tarjetas.
          </li>
          <li>Saldos contables y disponibles, y moneda.</li>
          <li>
            Cartola o movimientos: fecha, monto, descripción, tipo, número de documento y
            contraparte cuando el banco la entregue.
          </li>
          <li>
            Metadatos técnicos de la conexión (estado del enlace, fecha de última sincronización,
            identificadores de Fintoc).
          </li>
        </ul>
        <p>
          Qavante no solicita ni trata, para este servicio, claves de coordenadas, tokens de
          autorización de pagos, ni datos de tarjetas más allá de lo que el banco exponga en la
          cartola de solo lectura.
        </p>

        <h3 className="text-lg font-semibold">1.5. Finalidad</h3>
        <p>Los datos se usan exclusivamente para:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Mostrar tesorería y posición de caja de la empresa en Qavante.</li>
          <li>Clasificar y conciliar movimientos con facturas, impuestos y obligaciones.</li>
          <li>Proyectar caja y alimentar alertas, bandeja y reportes de gestión.</li>
          <li>
            Diagnosticar la calidad de la conexión (errores de sincronización, sesión vencida).
          </li>
          <li>
            Cumplir obligaciones legales, regulatorias o requerimientos de autoridad competente.
          </li>
        </ol>
        <p>
          No se usa la cartola para vender bases de datos a terceros, ni para scoring crediticio de
          terceros, ni para marketing de productos bancarios ajenos a Qavante, salvo consentimiento
          distinto y posterior.
        </p>

        <h3 className="text-lg font-semibold">1.6. Proveedor técnico (Fintoc)</h3>
        <p>
          Fintoc provee la infraestructura de conexión con los bancos chilenos. La autenticación
          ocurre en el entorno del banco o de Fintoc. Qavante no comparte la clave del banco con
          terceros distintos de Fintoc en el flujo técnico de autenticación, y no almacena esa clave
          una vez establecida la conexión. Fintoc trata los datos como encargado / procesador según
          el contrato entre Qavante y Fintoc. [PLACEHOLDER: anexar DPA y lista de subencargados de
          Fintoc.]
        </p>

        <h3 className="text-lg font-semibold">1.7. Credenciales y seguridad</h3>
        <p>
          La transmisión se realiza con TLS 1.3 u otro cifrado equivalente de extremo a extremo en
          tránsito. Las credenciales de Qavante (sesión de usuario) se cifran en reposo según las
          políticas internas. El Titular es responsable de la vigencia de sus apoderados y de no
          compartir usuarios de Qavante. Qavante aplicará medidas de control de acceso, registro de
          auditoría y minimización. [PLACEHOLDER: detalle de cifrado, retención de logs y ubicación
          de servidores.]
        </p>

        <h3 className="text-lg font-semibold">1.8. Plazo</h3>
        <p>
          El consentimiento rige desde la aceptación hasta el menor de estos hitos: (a) su
          revocación; (b) treinta y seis (36) meses, plazo máximo de referencia en Open Finance
          chileno, salvo que la norma aplicable fije otro; (c) término del contrato de Qavante; (d)
          baja de la institución o del enlace en Fintoc. Vencido el plazo, se pedirá un nuevo
          consentimiento para seguir leyendo datos.
        </p>

        <h3 className="text-lg font-semibold">1.9. Limitación de responsabilidad</h3>
        <p>
          Qavante no garantiza que el banco o Fintoc estén disponibles en todo momento, ni la
          exactitud de saldos en tiempo real. La información se muestra “tal como” la entrega la
          institución. Qavante no es el banco del Titular ni sustituye cartolas oficiales, ni asume
          obligaciones de la institución financiera. [PLACEHOLDER: topes de indemnización alineados
          al contrato comercial.]
        </p>

        <h3 className="text-lg font-semibold">1.10. Ley aplicable</h3>
        <p>
          Estos términos se rigen por las leyes de la República de Chile. Cualquier disputa se
          someterá a los tribunales de [PLACEHOLDER: comuna], sin perjuicio de derechos
          irrenunciables del consumidor o de la empresa según su calidad.
        </p>
      </section>

      <section
        id="privacidad"
        className="mt-12 scroll-mt-8 space-y-5 text-sm leading-7 text-neutral-dark"
      >
        <h2 className="text-2xl font-semibold">
          2. Política de privacidad de la conexión bancaria
        </h2>

        <h3 className="text-lg font-semibold">2.1. Responsable del tratamiento</h3>
        <p>
          Qavante SpA es responsable del tratamiento de los datos personales y financieros que se
          leen desde las instituciones conectadas, en los términos de la Ley N° 19.628 sobre
          protección de la vida privada y, cuando entre en vigor para el responsable, de la Ley N°
          21.719. Fintoc y el banco actúan en los roles que corresponda según la normativa del SFA y
          los contratos respectivos (responsable, corresponsable o encargado).
        </p>

        <h3 className="text-lg font-semibold">2.2. Categorías de titulares y datos</h3>
        <p>
          Se tratan datos de la empresa Titular y, eventualmente, de personas naturales apoderadas o
          titulares de cuentas (nombre, RUT, calidad de firmante). Los movimientos pueden contener
          nombres de contrapartes, empleados o proveedores. Qavante no busca categorías especiales
          (salud, afiliación política, etc.); si un movimiento las revelara de forma incidental, no
          se usan para esas finalidades.
        </p>

        <h3 className="text-lg font-semibold">2.3. Base jurídica</h3>
        <p>
          El tratamiento se funda en: (i) el consentimiento específico aquí otorgado; (ii) la
          ejecución del contrato de prestación de Qavante; (iii) el cumplimiento de deberes legales
          (conservación tributaria, requerimientos de autoridad); (iv) el interés legítimo de
          mantener la seguridad de la plataforma, en cuanto no prevalezcan derechos del titular.
        </p>

        <h3 className="text-lg font-semibold">2.4. Destinatarios</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Usuarios autorizados de la empresa en Qavante (roles owner/admin/operator).</li>
          <li>Fintoc, como proveedor de agregación bancaria.</li>
          <li>
            Proveedores de infraestructura cloud, soporte y seguridad de Qavante, bajo contrato de
            encargo. [PLACEHOLDER: lista de subencargados.]
          </li>
          <li>Autoridades cuando una norma o orden judicial lo exija.</li>
        </ul>
        <p>No se venden datos personales.</p>

        <h3 className="text-lg font-semibold">2.5. Transferencias internacionales</h3>
        <p>
          [PLACEHOLDER: indicar si Fintoc o la nube de Qavante tratan datos fuera de Chile, país de
          destino, garantías (cláusulas contractuales, certificación) y cómo solicitar copia.]
        </p>

        <h3 className="text-lg font-semibold">2.6. Conservación</h3>
        <p>
          Los movimientos se conservan mientras la empresa mantenga la cuenta Qavante y, después de
          la baja, el plazo mínimo necesario para obligaciones tributarias y de defensa jurídica
          (referencia: hasta 6 años, [PLACEHOLDER: confirmar con asesoría]). Los logs de
          consentimiento se conservan el tiempo que exija el SFA. Tras la revocación se deja de leer
          datos nuevos; los históricos ya importados se tratan según la política general de Qavante,
          no se “apagan” de la cartola ya conciliada salvo instrucción de borrado procedente.
        </p>

        <h3 className="text-lg font-semibold">2.7. Seguridad</h3>
        <p>
          Cifrado en tránsito (TLS 1.3), control de acceso por sesión, segregación por empresa
          (tenant), registro de sincronizaciones y principio de mínimo privilegio. Ningún texto de
          esta política sustituye una evaluación de impacto ni un informe de auditoría.
        </p>
      </section>

      <section
        id="revocacion"
        className="mt-12 scroll-mt-8 space-y-5 text-sm leading-7 text-neutral-dark"
      >
        <h2 className="text-2xl font-semibold">3. Revocación y derechos</h2>
        <p>
          El Titular puede revocar el consentimiento en cualquier momento, sin efecto retroactivo,
          desde Administración → Credenciales o pidiendo la baja del enlace a{" "}
          <span className="font-medium">privacidad@qavante.com</span> [PLACEHOLDER]. La revocación
          impide nuevas lecturas; puede dejar de actualizarse Banco y Caja.
        </p>
        <p>
          Derechos de acceso, rectificación, cancelación, oposición, portabilidad y limitación se
          ejercen ante Qavante en el mismo correo, con RUT de la empresa y del solicitante. Qavante
          responderá en los plazos legales. También puede reclamarse ante el organismo competente en
          protección de datos o ante la CMF en materias de Open Finance, cuando corresponda.
        </p>
        <p>
          Si el Titular detecta un incidente de seguridad, debe notificarlo de inmediato a
          [PLACEHOLDER: seguridad@qavante.com]. Qavante notificará a afectados y autoridades cuando
          la ley lo exija.
        </p>

        <h3 className="text-lg font-semibold">3.1. Contacto</h3>
        <p>
          Qavante SpA · Delegado de protección de datos / responsable de privacidad
          <br />
          Correo: privacidad@qavante.com
          <br />
          Domicilio: [PLACEHOLDER]
        </p>

        <p className="pt-4 text-neutral-mid">
          Fin del documento placeholder. Este texto debe versionarse (v1.0, v1.1, …), datarse y
          sustituirse por la minuta legal aprobada antes de cualquier ambiente de clientes reales.
        </p>
      </section>
    </article>
  );
}
