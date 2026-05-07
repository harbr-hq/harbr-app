pub mod compose;
pub mod containers;
pub mod events;
pub mod groups;
pub mod health;
pub mod images;
pub mod info;
pub mod logs;
pub mod networks;
pub mod volumes;

use axum::{http::{header, Method}, middleware, Router};
use tower_http::cors::CorsLayer;

use crate::daemon::{auth, AppState};

pub fn router(state: AppState) -> Router {
    Router::new()
        .nest(
            "/api/v1",
            api_v1().layer(middleware::from_fn_with_state(
                state.clone(),
                auth::require_auth,
            )),
        )
        .layer(cors())
        .with_state(state)
}

fn api_v1() -> Router<AppState> {
    Router::new()
        .merge(compose::router())
        .merge(containers::router())
        .merge(events::router())
        .merge(groups::router())
        .merge(health::router())
        .merge(images::router())
        .merge(info::router())
        .merge(logs::router())
        .merge(networks::router())
        .merge(volumes::router())
}

fn cors() -> CorsLayer {
    let allowed_origins = [
        "http://localhost:1420".parse().expect("valid origin"),
        "tauri://localhost".parse().expect("valid origin"),
    ];
    CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
}
