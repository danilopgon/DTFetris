//! Local stdio only: stdout is reserved exclusively for MCP JSON-RPC frames.
fn main() {
    if let Err(error) = dtf_sheet_optimizer_lib::mcp::run_cli(std::env::args().skip(1)) {
        eprintln!("DTFetris MCP: {error}");
        std::process::exit(1);
    }
}
