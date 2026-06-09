from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api_key_validator import validate_api_key
from database import get_db
from models import Task, TaskStatus
from schemas import TaskResultOut, TaskStatusOut

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/{task_uuid}/status", response_model=TaskStatusOut)
async def get_task_status(
    task_uuid: str,
    x_api_key: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    task = await db.scalar(select(Task).where(Task.uuid == task_uuid))
    if not task:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "task", "message": "Task not found."}],
        )

    await validate_api_key(db, x_api_key, task.service.service_key)

    return TaskStatusOut(
        task_uuid=task.uuid,
        status=task.status,
        created_at=task.created_at,
        completed_at=task.completed_at,
        error_message=task.error_message,
    )


@router.get("/{task_uuid}/result", response_model=TaskResultOut)
async def get_task_result(
    task_uuid: str,
    x_api_key: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    task = await db.scalar(select(Task).where(Task.uuid == task_uuid))
    if not task:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "task", "message": "Task not found."}],
        )

    await validate_api_key(db, x_api_key, task.service.service_key)

    if task.status not in (TaskStatus.completed, TaskStatus.failed):
        raise HTTPException(
            status_code=400,
            detail=[{"field": "task", "message": f"Task is still {task.status.value}. Check status endpoint for updates."}],
        )

    return TaskResultOut(
        task_uuid=task.uuid,
        status=task.status,
        response_status_code=task.response_status_code,
        response_content_type=task.response_content_type,
        tokens_used=task.tokens_used,
        completed_at=task.completed_at,
        error_message=task.error_message,
    )


@router.get("/{task_uuid}/download")
async def download_task_result(
    task_uuid: str,
    x_api_key: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    task = await db.scalar(select(Task).where(Task.uuid == task_uuid))
    if not task:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "task", "message": "Task not found."}],
        )

    await validate_api_key(db, x_api_key, task.service.service_key)

    if task.status != TaskStatus.completed:
        raise HTTPException(
            status_code=400,
            detail=[{"field": "task", "message": f"Task status is {task.status.value}, cannot download result."}],
        )

    if task.response_body is None:
        raise HTTPException(
            status_code=404,
            detail=[{"field": "response_body", "message": "No response body available for this task."}],
        )

    from fastapi.responses import Response

    return Response(
        content=task.response_body,
        status_code=task.response_status_code or 200,
        media_type=task.response_content_type,
    )