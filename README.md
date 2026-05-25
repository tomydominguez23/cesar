# Pro Trading Academy USA - Portal de Estudio de Trading

Portal educativo completo para aprendizaje de trading profesional, inspirado en plataformas como Kajabi.

## Estructura del Proyecto

```
/
├── index.html          # Landing page / Pagina de ventas
├── login.html          # Pagina de inicio de sesion
├── dashboard.html      # Biblioteca de programas (Mi Dashboard)
├── course.html         # Detalle de curso con reproductor de video
├── calendar.html       # Calendario de clases y eventos
├── faq.html            # Preguntas frecuentes y centro de soporte
├── css/
│   └── styles.css      # Estilos CSS personalizados
├── js/
│   └── app.js          # JavaScript principal (animaciones, interactividad)
└── assets/
    └── images/         # Carpeta para imagenes
```

## Paginas Incluidas

### 1. Landing Page (`index.html`)
- Hero section con estadisticas animadas y grafico de barras
- Seccion de caracteristicas del programa
- Ruta Pro Trading (9 pasos)
- Preview de cursos disponibles
- Contadores animados
- Planes de precios (Basico, Profesional, VIP)
- Testimonios de estudiantes
- Horario de clases en vivo
- Preguntas frecuentes (FAQ)
- Call-to-action y footer completo

### 2. Login (`login.html`)
- Diseno split-screen (visual + formulario)
- Login con email/password
- Opciones de Google y Facebook
- Mostrar/ocultar contrasena

### 3. Dashboard (`dashboard.html`)
- Barra de navegacion del portal
- Header con estadisticas del estudiante
- Banner de calendario
- Grid de 7 programas con progreso
- Herramientas y descargas rapidas
- Actividad reciente

### 4. Detalle de Curso (`course.html`)
- Reproductor de video con controles
- Sidebar con lista de lecciones y progreso
- Banner de completado con siguiente leccion
- Descripcion del curso
- Material de apoyo descargable
- Seccion de comentarios

### 5. Calendario (`calendar.html`)
- Calendario mensual interactivo (generado con JS)
- Navegacion entre meses
- Eventos codificados por color
- Leyenda de tipos de eventos
- Lista de proximos eventos
- Tarjetas de eventos destacados

### 6. FAQ y Soporte (`faq.html`)
- Buscador de preguntas
- Categorias rapidas navegables
- Acordeones de preguntas por categoria (General, Plataformas, Brokers, Clases, Cuenta)
- Sidebar con herramientas y descargas
- Tutoriales de video listados
- Contacto de soporte

## Tecnologias

- **HTML5** semantico
- **CSS3** con variables personalizadas, gradientes, animaciones y responsive design
- **JavaScript** vanilla (sin frameworks)
- **Google Fonts** (Inter)
- **Font Awesome 6** para iconos

## Como Usar

1. Abrir `index.html` en un navegador web
2. Navegar por las diferentes secciones y paginas
3. El login redirige al dashboard (demo, sin backend)

## Despliegue automatico (GitHub → cPanel por FTP)

Cada push a la rama `main` sube los archivos del sitio a cPanel mediante FTPS (puerto 21, modo explicito).

### Datos FTP configurados en el workflow

| Campo | Valor |
|-------|--------|
| Servidor | `ftp.ditecno.cl` |
| Usuario | `admin@protradingacademy.com` |
| Puerto / protocolo | `21` / FTPS explicito |

### Paso obligatorio: secreto en GitHub

La contraseña de la cuenta FTP **no** va en el repositorio. Debes crearla una sola vez en GitHub:

1. Abre el repositorio en GitHub: `https://github.com/tomydominguez23/cesar`
2. Ve a **Settings** → **Secrets and variables** → **Actions**
3. Pulsa **New repository secret**
4. Nombre: `FTP_PASSWORD`
5. Valor: la contraseña que definiste al crear la cuenta FTP en cPanel
6. Guarda el secreto

### Probar el despliegue

- Haz merge de los cambios a `main`, o ejecuta manualmente **Actions** → **Desplegar a cPanel (FTP)** → **Run workflow**.
- Revisa el log del job; si falla por ruta remota, en cPanel confirma la carpeta raíz del FTP (a veces es `public_html/`). En ese caso edita `server-dir` en `.github/workflows/deploy-cpanel-ftp.yml` (por ejemplo `public_html/`).

### Notas

- No subas `.github/` ni archivos de git al hosting (ya están excluidos).
- Si cambias la contraseña FTP en cPanel, actualiza el secreto `FTP_PASSWORD` en GitHub.

## Programas/Cursos Incluidos

- Primeros Pasos
- Preguntas Frecuentes
- Elementos de Soporte
- El Mercado
- Investips & Investnews
- Sabados Analiticos
- Seminario Intensivo

## Responsive Design

El portal es completamente responsive y se adapta a:
- Desktop (1200px+)
- Tablet (768px - 1024px)
- Mobile (< 768px)
