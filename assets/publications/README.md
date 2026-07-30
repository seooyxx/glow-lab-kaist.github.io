# Publication thumbnails

This directory contains the generated media for every publication shown on
`publications.html`.

- `*.webp`: 192 × 134 list thumbnails.
- `card-media/*.webp`: cropped media for the 3:4 publication cards.
- `motion/*.mp4`: short, muted H.264 hover previews for 13 publications.
- `media-manifest.json`: the single source of truth for source URLs, focal
  points, poster times, and output settings.

For a publication with motion, the card still is extracted from the optimized
MP4 at `posterTime`. The still and the first hover state therefore use the same
crop and scene instead of two unrelated source images.

The files are presentation thumbnails only. Copyright remains with the
respective paper authors and source sites. Use the links below when replacing,
redistributing, or checking an asset.

Run the optimizer from the repository root:

```sh
# Validate the manifest and generated file coverage.
bash scripts/optimize-publication-media.sh --check

# Rebuild one publication while tuning its crop.
bash scripts/optimize-publication-media.sh align-your-gaussians

# Rebuild all 30 publications.
bash scripts/optimize-publication-media.sh --all
```

The script requires `curl`, `jq`, and `ffmpeg`. ImageMagick's `convert` is used
for the animated L4GM source, and PyMuPDF (`fitz`) is used for the two PDF-only
publications. Downloads and intermediate originals live in a temporary
directory and are removed automatically; only optimized outputs are written
under `assets/publications/`.

To adjust a crop, edit the publication's normalized `focalPoint.x` and
`focalPoint.y` values in `media-manifest.json` and rebuild that slug. To change
the static frame for a motion card, edit `posterTime`; this value is relative to
the optimized six-second preview.

| File | Publication | Source page |
| --- | --- | --- |
| `instant-nurec.webp` | Instant NuRec | [NVIDIA Research](https://research.nvidia.com/labs/sil/projects/instant-nurec/) |
| `omnidreams.webp` | NVIDIA OmniDreams | [NVIDIA Research](https://research.nvidia.com/labs/sil/projects/omnidreams-blog/) |
| `ddspo.webp` | Direct Diffusion Score Preference Optimization | [Project page](https://dohyun-as.github.io/DDSPO/) |
| `connecting-the-objects.webp` | Connecting the Objects | [Pattern Recognition Letters](https://www.sciencedirect.com/science/article/abs/pii/S0167865526002230) |
| `cosmos-drive-dreams.webp` | Cosmos-Drive-Dreams | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/cosmos_drive_dreams) |
| `random-conditioning.webp` | Random Conditioning | [Project page](https://dohyun-as.github.io/Random-Conditioning/) |
| `cosmos-world.webp` | Cosmos World Foundation Model Platform | [arXiv](https://arxiv.org/abs/2501.03575) |
| `l4gm.webp` | L4GM | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/l4gm/) |
| `distillnerf.webp` | DistillNeRF | [Project page](https://distillnerf.github.io/) |
| `diffusion-texture-painting.webp` | Diffusion Texture Painting | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/DiffusionTexturePainting/) |
| `align-your-gaussians.webp` | Align Your Gaussians | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/AlignYourGaussians/) |
| `emerdiff.webp` | EmerDiff | [Project page](https://kmcode1.github.io/Projects/EmerDiff/) |
| `emernerf.webp` | EmerNeRF | [Project page](https://emernerf.github.io/) |
| `wildfusion.webp` | WildFusion | [Project page](https://katjaschwarz.github.io/wildfusion/) |
| `dreamteacher.webp` | DreamTeacher | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/DreamTeacher/) |
| `neuralfield-ldm.webp` | NeuralField-LDM | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/NFLDM/) |
| `video-ldm.webp` | Align your Latents | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/VideoLDM/) |
| `polymorphicgan.webp` | PolymorphicGAN | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/PMGAN/) |
| `bigdatasetgan.webp` | BigDatasetGAN | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/big-datasetgan/) |
| `histopathology-consistency.webp` | Self-Supervised Driven Consistency Training | [arXiv](https://arxiv.org/abs/2102.03897) |
| `editgan.webp` | EditGAN | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/editGAN/) |
| `drivegan.webp` | DriveGAN | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/DriveGAN/) |
| `amodal-vae.webp` | Variational Amodal Object Completion | [Project page](http://www.cs.toronto.edu/~linghuan/vae_mask/) |
| `gamegan.webp` | GameGAN | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/gameGAN/) |
| `progressive-module-networks.webp` | Visual Reasoning by Progressive Module Networks | [Project page](https://seung-kim.github.io/pmn_pj_page/) |
| `shmoop-corpus.webp` | The Shmoop Corpus | [arXiv](https://arxiv.org/abs/1912.13082) |
| `cascaded-pyramid-network.webp` | Cascaded Pyramid Network for 3D Human Pose | [arXiv](https://arxiv.org/abs/1810.01616) |
| `keep-and-learn.webp` | Keep and Learn | [arXiv](https://arxiv.org/abs/1805.10784) |
| `class-distance-loss.webp` | Class-Distance Loss | [OpenReview](https://openreview.net/forum?id=ByXrfaGFe&noteId=ByXrfaGFe) |
| `huffman-text-entry.webp` | Word Prediction and r-ary Huffman Coding | [ISCA Archive](https://www.isca-archive.org/slpat_2016/kim16_slpat.html) |
