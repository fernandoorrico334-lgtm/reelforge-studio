# ComfyUI Model Integrity Report

Date: 2026-06-30
Workspace: `C:\Users\Pichau\Documents\New project\reelforge-studio-clean`
ComfyUI base URL: `http://127.0.0.1:8189`

## Summary

The current ReelForge <-> ComfyUI integration is working at the transport/workflow level, but two required local model files were confirmed as truncated on disk and were moved to quarantine for safe manual reinstallation:

- `qwen_3_4b.safetensors`
- `z_image_turbo_bf16.safetensors`

The VAE file `ae.safetensors` appears intact and was not moved.

## Files Detected

### 1. `qwen_3_4b.safetensors`

- Active path:
  `C:\Users\Pichau\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\text_encoders\qwen_3_4b.safetensors`
- Quarantine path:
  `C:\Users\Pichau\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\text_encoders\_corrupted_models_quarantine\qwen_3_4b.safetensors`
- `.dl-meta` path:
  `C:\Users\Pichau\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\text_encoders\qwen_3_4b.safetensors.dl-meta`
- Expected size from `.dl-meta`: `8044982048`
- Real file size found: `999355414`
- Declared safetensors payload: `8044936192`
- Real payload available: `999309558`
- Status: `TRUNCATED`
- Action taken: `MOVED TO QUARANTINE`

### 2. `z_image_turbo_bf16.safetensors`

- Active path:
  `C:\Users\Pichau\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\diffusion_models\z_image_turbo_bf16.safetensors`
- Quarantine path:
  `C:\Users\Pichau\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\diffusion_models\_corrupted_models_quarantine\z_image_turbo_bf16.safetensors`
- `.dl-meta` path:
  `C:\Users\Pichau\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\diffusion_models\z_image_turbo_bf16.safetensors.dl-meta`
- Expected size from `.dl-meta`: `12309866400`
- Real file size found: `1004784492`
- Declared safetensors payload: `12309817472`
- Real payload available: `1004735564`
- Status: `TRUNCATED`
- Action taken: `MOVED TO QUARANTINE`

### 3. `ae.safetensors`

- Active path:
  `C:\Users\Pichau\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\vae\ae.safetensors`
- Quarantine path:
  `C:\Users\Pichau\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\vae\_corrupted_models_quarantine\ae.safetensors`
- `.dl-meta` path:
  `C:\Users\Pichau\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\vae\ae.safetensors.dl-meta`
- Expected size from `.dl-meta`: `not available`
- Real file size found: `335304388`
- Declared safetensors payload: `335278732`
- Real payload available: `335278732`
- Status: `INTACT`
- Action taken: `LEFT IN PLACE`

## Quarantine Directories

- `C:\Users\Pichau\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\text_encoders\_corrupted_models_quarantine`
- `C:\Users\Pichau\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\diffusion_models\_corrupted_models_quarantine`

## Disk Space

- Drive: `C:\`
- Total size: `949.22 GB`
- Available free space: `203.37 GB`

## Interpretation

The failure is not a ReelForge architecture issue. The workflow override is valid and ComfyUI accepts the prompt graph, but execution fails when `CLIPLoader` tries to load the truncated text encoder file. The two quarantined files are materially smaller than both:

- the expected sizes recorded by Comfy Desktop download metadata
- the payload sizes declared in their safetensors headers

This confirms incomplete/corrupted local model downloads.

## Manual Recovery Instructions

Do not restore the quarantined files manually.

Reinstall or redownload the missing models through ComfyUI Desktop / Manager so that ComfyUI recreates fresh copies in the active model folders:

- text encoder: `qwen_3_4b.safetensors`
- diffusion model: `z_image_turbo_bf16.safetensors`

Recommended flow:

1. Open ComfyUI Desktop.
2. Use the Desktop/Manager model install flow for Z-Image-Turbo.
3. Confirm that fresh copies are recreated in:
   - `...\models\text_encoders\`
   - `...\models\diffusion_models\`
4. Do not reuse the quarantined files.
5. After the downloads finish, return to ReelForge validation and rerun:
   - `npm run db:generate`
   - `npm run smoke:comfy-provider:local`
   - `npm run smoke:hybrid-visual:render-ready`

## Notes

- No models were deleted.
- Only the two truncated `.safetensors` files were moved.
- `ae.safetensors` was preserved because its declared payload matches the available payload exactly.
