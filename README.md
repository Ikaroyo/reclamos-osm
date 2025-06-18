# Sistema de Reclamos OSM

Sistema de gestión de reclamos para distribuidores, desarrollado con React, TypeScript y Supabase.

## 🚀 Características

- **Gestión de Reclamos**: Crear, editar y eliminar reclamos
- **Estadísticas**: Visualización de datos por repartidor y período
- **Gestión de Usuarios**: Panel de administración para usuarios
- **Gestión de Repartidores**: CRUD completo de repartidores
- **Importación/Exportación**: Soporte para archivos Excel
- **Autenticación**: Sistema seguro con roles de usuario
- **Responsive**: Diseño adaptable para dispositivos móviles

## 🛠️ Tecnologías

- **Frontend**: React 18 + TypeScript
- **Backend**: Supabase (PostgreSQL + Auth)
- **Styling**: CSS modular
- **Build Tool**: Vite
- **Deployment**: GitHub Pages

## 📋 Requisitos Previos

- Node.js 16 o superior
- npm/pnpm
- Cuenta de Supabase

## 🔧 Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/Ikaroyo/reclamos-osm.git
cd reclamos-osm
```

2. Instala las dependencias:
```bash
pnpm install
```

3. Configura las variables de entorno:
```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:
```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

4. Configura la base de datos ejecutando el archivo `supabase-schema.sql` en tu proyecto de Supabase.

## 🚀 Desarrollo

```bash
# Ejecutar en modo desarrollo
pnpm dev

# Construir para producción
pnpm build

# Vista previa de la construcción
pnpm preview
```

## 📦 Deployment

El proyecto está configurado para desplegarse automáticamente en GitHub Pages:

```bash
# Desplegar a GitHub Pages
pnpm deploy
```

## 👥 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🔗 Links

- **Demo**: [https://ikaroyo.github.io/reclamos-osm/](https://ikaroyo.github.io/reclamos-osm/)
- **Repositorio**: [https://github.com/Ikaroyo/reclamos-osm](https://github.com/Ikaroyo/reclamos-osm)
