# imghacks

API asincrona de generacion de imagenes con pagina publica. Dos motores detras de una misma interfaz:

- **Flow**: los modelos Gemini de Google Flow (`nano-banana-2.1`, `nano-banana-pro`, `nano-banana-2-lite`) a traves de `gflow-cli`.
- **Hacks**: Perchance, sin filtros y apto para +18, con un pool de navegadores y rotacion de proxies.

Produccion: https://img.hacks.win

## Arquitectura

```
src/
  server.js            arranque
  app.js               composicion: stores, proveedores, rutas
  config.js            toda la configuracion sale del entorno
  core/                piezas sin dependencias entre proveedores
    queue.js           cola con concurrencia limitada
    jobs.js            ciclo de vida de una generacion
    images.js          almacen temporal en disco con caducidad
    keys.js            API keys (solo se guarda el hash)
    limiter.js         ventana deslizante para la pagina publica
    generation.js      validacion de la peticion
    guard.js           rechazo de prompts prohibidos
  providers/
    index.js           registro de modelos
    flow.js            gflow-cli, una generacion a la vez por sesion
    hacks/             cliente de Perchance, pool de workers y de proxies
    mock.js            proveedor de desarrollo
  routes/
    generations.js     mismas rutas para /v1 (API key) y /web (publica)
    openai.js          POST /v1/images/generations compatible con OpenAI
    policies.js        autenticacion y limites de cada superficie
web/                   pagina estatica, sin paso de build
deploy/                systemd, nginx y scripts
```

Cada generacion es un trabajo: se encola, el cliente recibe un `id` al instante y consulta su estado. Cada proveedor
tiene su propia cola, asi que muchas peticiones simultaneas esperan turno sin bloquearse entre motores. Las imagenes
se guardan en disco con nombre aleatorio y se borran a los 30 minutos.

## API

Todas las rutas de `/v1` piden `Authorization: Bearer <key>` (o `x-api-key`).

| Ruta | Descripcion |
| --- | --- |
| `GET /v1/models` | modelos con sus formatos, estilos, maximo de imagenes y cola actual |
| `POST /v1/generations` | crea una generacion, responde `202` con el trabajo |
| `GET /v1/generations/:id` | estado (`queued`, `running`, `done`, `failed`) e imagenes |
| `POST /v1/images/generations` | formato OpenAI (`size`, `response_format`), responde al terminar |

Cuerpo de `POST /v1/generations`:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `prompt` | texto | obligatorio, hasta 2000 caracteres |
| `model` | texto | por defecto el primero de `/v1/models` |
| `n` | entero | 1 a 4 en Flow, 1 a 6 en hacks |
| `aspect` | texto | `1:1`, `3:4`, `4:3`, `9:16`, `16:9` |
| `style` | texto | solo hacks: `none`, `photo`, `90s-photo`, `80s-photo`, `anime`, `painting`, `pixel-art`, `cinematic` |
| `images` | lista | solo Gemini: hasta 4 imagenes (3 en lite) en base64 o data URL, PNG/JPEG/WebP de 8 MB como maximo. Con ellas el modelo edita o combina segun el prompt |
| `negative` | texto | solo hacks |
| `nsfw` | booleano | fuerza el modelo hacks |

```bash
curl -X POST https://img.hacks.win/v1/generations \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"model":"nano-banana-pro","prompt":"un faro al atardecer","n":2,"aspect":"16:9"}'

curl https://img.hacks.win/v1/generations/$ID -H "Authorization: Bearer $KEY"
```

## API keys

```bash
npm run keys -- create nombre-del-cliente
npm run keys -- list
npm run keys -- revoke nombre-del-cliente
```

La clave se muestra una sola vez. En el servidor: `cd /opt/imghacks/app && sudo -u gflow ../runtime/bin/node --env-file=../env scripts/keys.js create nombre`.

## Desarrollo

```bash
npm install
PROVIDERS=mock PUBLIC_URL=http://localhost:8796 npm run dev
```

El proveedor `mock` devuelve imagenes de prueba con latencia simulada, sin tocar Flow ni Perchance.

## Despliegue

```bash
SSH="ssh root@servidor" deploy/deploy.sh --setup   # la primera vez
SSH="ssh root@servidor" deploy/deploy.sh           # siguientes
```

La configuracion vive en `/opt/imghacks/env` (ver `.env.example`). El servicio corre como el usuario `gflow`, que es
quien tiene la sesion de Google Flow, con un tope de memoria para convivir con el resto del servidor.
