pub mod crud;
pub mod logs;
pub mod settings;
pub mod stats;
pub mod terminal;

use axum::Router;

use crate::daemon::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .merge(crud::router())
        .merge(logs::router())
        .merge(settings::router())
        .merge(stats::router())
        .merge(terminal::router())
}
