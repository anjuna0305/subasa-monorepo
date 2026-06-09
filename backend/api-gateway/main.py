import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import engine
from models import Base
from routers._http import close_http_client
from routers.api_keys import router as api_keys_router
from routers.custom_chatbots import router as custom_chatbots_router
from routers.tts import router as tts_router
from routers.gateway import router as gateway_router
from routers.organizations import router as organization_router
from routers.services import router as services_router
from routers.tasks import router as tasks_router
from routers.usage import router as usage_router
from routers.users import router as users_router
from task_worker import start_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    worker_task = await start_worker()

    yield

    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

    await close_http_client()
    await engine.dispose()


app = FastAPI(title="Subasa API Example", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"field": e["loc"][-1], "message": e["msg"].replace("Value error, ", "")}
        for e in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


# @app.middleware("http")
# async def delay_middleware(request: Request, call_next):
#     response = await call_next(request)
#     await asyncio.sleep(1)
#     return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(api_keys_router)
app.include_router(services_router)
app.include_router(usage_router)
app.include_router(gateway_router)
app.include_router(tasks_router)
app.include_router(organization_router)
app.include_router(custom_chatbots_router)
app.include_router(tts_router)
