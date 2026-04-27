use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

/// Unified error type for all Axum REST handlers.
///
/// Implements `IntoResponse` so it can be returned directly from handlers.
/// `From` impls for `anyhow::Error` and `bollard::errors::Error` let the `?`
/// operator work on most fallible calls without any `map_err` boilerplate.
pub struct AppError {
    pub status: StatusCode,
    pub message: String,
}

impl AppError {
    /// 500 Internal Server Error — unexpected or unrecoverable failure.
    pub fn internal(e: impl std::fmt::Display) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: e.to_string(),
        }
    }

    /// 404 Not Found.
    pub fn not_found(msg: impl std::fmt::Display) -> Self {
        Self { status: StatusCode::NOT_FOUND, message: msg.to_string() }
    }

    /// 403 Forbidden.
    pub fn forbidden(msg: impl std::fmt::Display) -> Self {
        Self { status: StatusCode::FORBIDDEN, message: msg.to_string() }
    }

    /// 422 Unprocessable Entity — validation failures.
    pub fn unprocessable(msg: impl std::fmt::Display) -> Self {
        Self { status: StatusCode::UNPROCESSABLE_ENTITY, message: msg.to_string() }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, self.message).into_response()
    }
}

/// `?` on `anyhow::Result` in handlers — covers all DB function calls.
impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        Self::internal(e)
    }
}

/// `?` on bollard (Podman) calls in handlers — no `map_err` needed.
///
/// Known Podman error patterns are mapped to appropriate HTTP status codes and
/// human-readable messages. Everything else falls through to 500.
impl From<bollard::errors::Error> for AppError {
    fn from(e: bollard::errors::Error) -> Self {
        let msg = e.to_string();

        if msg.contains("address already in use") || msg.contains("rootlessport") {
            return Self::unprocessable(
                "A host port required by this container is already in use. \
                 Stop the conflicting container or process first.",
            );
        }
        if msg.contains("No such container") {
            return Self::not_found("Container not found");
        }
        if msg.contains("No such image") || msg.contains("image not known") || msg.contains("not found in") {
            return Self::not_found("Image not found — pull it with Podman first");
        }
        if msg.contains("name is already in use") || msg.contains("Conflict") {
            return Self::unprocessable(
                "A container with that name already exists. \
                 Remove or rename the existing container first.",
            );
        }
        if msg.contains("already started") || msg.contains("is already running") {
            return Self::unprocessable("Container is already running");
        }
        if msg.contains("is not running") {
            return Self::unprocessable("Container is not running");
        }

        tracing::error!("Podman error: {msg}");
        Self::internal(e)
    }
}
