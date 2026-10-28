$source = @"
using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;

public class SmoothSpriteProcessor
{
    public static void Process(string inputPath, string outputSheetPath, string outputFramesDir)
    {
        using (Bitmap src = new Bitmap(inputPath))
        {
            // Row bounds in raw image (excluding black table borders)
            int[] rowTops = new int[] { 118, 283, 450, 620 };
            int[] rowBottoms = new int[] { 241, 411, 578, 747 };

            // Column bounds in raw image (excluding black table borders)
            int[] colLefts = new int[] { 54, 285, 514, 740 };
            int[] colRights = new int[] { 280, 509, 734, 969 };

            string[] rowNames = new string[] { "idle", "walk", "attack", "hurt" };
            Directory.CreateDirectory(outputFramesDir);

            int targetCellSize = 128;
            Bitmap masterSheet = new Bitmap(targetCellSize * 4, targetCellSize * 4, PixelFormat.Format32bppArgb);

            using (Graphics gMaster = Graphics.FromImage(masterSheet))
            {
                gMaster.Clear(Color.Transparent);
                gMaster.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                gMaster.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                gMaster.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;

                Func<Color, bool> isBg = (col) =>
                {
                    // Checkerboard light grey (~225) & white (~250)
                    if (col.R > 195 && col.G > 195 && col.B > 195)
                    {
                        int dRG = Math.Abs(col.R - col.G);
                        int dGB = Math.Abs(col.G - col.B);
                        int dRB = Math.Abs(col.R - col.B);
                        if (dRG <= 12 && dGB <= 12 && dRB <= 12)
                            return true;
                    }
                    // Border dark grey remnants
                    if (col.R >= 135 && col.R <= 175 && Math.Abs(col.R - col.G) <= 6 && Math.Abs(col.G - col.B) <= 6)
                        return true;

                    return false;
                };

                // The soldier's vertical axis in each cell is around:
                // Col 0: 54 + 114 = 168
                // Col 1: 285 + 112 = 397
                // Col 2: 514 + 113 = 627
                // Col 3: 740 + 113 = 853
                int[] colAnchorX = new int[] { 168, 397, 627, 853 };

                // The soldier's ground feet level in each row:
                // Row 0 (Idle): 118 + 122 = 240
                // Row 1 (Walk): 283 + 124 = 407
                // Row 2 (Attack): 450 + 126 = 576
                // Row 3 (Hurt): 620 + 126 = 746
                int[] rowAnchorY = new int[] { 240, 407, 576, 746 };

                // UNIFORM GLOBAL SCALE:
                // Height in raw image is ~122px. We want target height to be ~108px in 128x128.
                // Scale = 108 / 122 = 0.885
                float uniformScale = 0.885f;

                // Anchor in target 128x128 cell:
                // Center X = 64
                // Ground feet Y = 118
                int targetAnchorX = 64;
                int targetAnchorY = 118;

                for (int r = 0; r < 4; r++)
                {
                    int top = rowTops[r];
                    int btm = rowBottoms[r];
                    int cellH = btm - top + 1;
                    int anchorY = rowAnchorY[r];

                    for (int c = 0; c < 4; c++)
                    {
                        int left = colLefts[c];
                        int right = colRights[c];
                        int cellW = right - left + 1;
                        int anchorX = colAnchorX[c];

                        // Extract and clean raw cell bitmap
                        Bitmap cleanCell = new Bitmap(cellW, cellH, PixelFormat.Format32bppArgb);
                        for (int y = 0; y < cellH; y++)
                        {
                            for (int x = 0; x < cellW; x++)
                            {
                                cleanCell.SetPixel(x, y, src.GetPixel(left + x, top + y));
                            }
                        }

                        // Edge flood-fill to mark background
                        bool[,] isBgMap = new bool[cellW, cellH];
                        Queue<Point> q = new Queue<Point>();

                        for (int x = 0; x < cellW; x++)
                        {
                            if (isBg(cleanCell.GetPixel(x, 0))) { isBgMap[x, 0] = true; q.Enqueue(new Point(x, 0)); }
                            if (isBg(cleanCell.GetPixel(x, cellH - 1))) { isBgMap[x, cellH - 1] = true; q.Enqueue(new Point(x, cellH - 1)); }
                        }
                        for (int y = 0; y < cellH; y++)
                        {
                            if (isBg(cleanCell.GetPixel(0, y))) { isBgMap[0, y] = true; q.Enqueue(new Point(0, y)); }
                            if (isBg(cleanCell.GetPixel(cellW - 1, y))) { isBgMap[cellW - 1, y] = true; q.Enqueue(new Point(cellW - 1, y)); }
                        }

                        int[] dx = { 0, 0, 1, -1 };
                        int[] dy = { 1, -1, 0, 0 };
                        while (q.Count > 0)
                        {
                            Point pt = q.Dequeue();
                            for (int i = 0; i < 4; i++)
                            {
                                int nx = pt.X + dx[i];
                                int ny = pt.Y + dy[i];
                                if (nx >= 0 && nx < cellW && ny >= 0 && ny < cellH && !isBgMap[nx, ny])
                                {
                                    Color nCol = cleanCell.GetPixel(nx, ny);
                                    if (isBg(nCol))
                                    {
                                        isBgMap[nx, ny] = true;
                                        q.Enqueue(new Point(nx, ny));
                                    }
                                }
                            }
                        }

                        // Apply transparency with edge softening
                        for (int y = 0; y < cellH; y++)
                        {
                            for (int x = 0; x < cellW; x++)
                            {
                                if (isBgMap[x, y] || isBg(cleanCell.GetPixel(x, y)))
                                {
                                    cleanCell.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                                }
                            }
                        }

                        // Now render into singleFrame (128x128) using ANCHOR-BASED ALIGNMENT:
                        // The anchor in cleanCell is at (anchorX - left, anchorY - top).
                        int localAnchorX = anchorX - left;
                        int localAnchorY = anchorY - top;

                        // Slight per-frame manual micro-correction if needed:
                        // For attack frame 2, 3: anchorX stays at the soldier's body, muzzle flash extends right!
                        // That keeps the soldier's body completely stable!
                        Bitmap singleFrame = new Bitmap(targetCellSize, targetCellSize, PixelFormat.Format32bppArgb);
                        using (Graphics gf = Graphics.FromImage(singleFrame))
                        {
                            gf.Clear(Color.Transparent);
                            gf.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                            gf.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;

                            // Calculate destination rectangle for cleanCell
                            // localAnchor will map to targetAnchor
                            float dstLeft = targetAnchorX - (localAnchorX * uniformScale);
                            float dstTop = targetAnchorY - (localAnchorY * uniformScale);
                            float dstW = cellW * uniformScale;
                            float dstH = cellH * uniformScale;

                            gf.DrawImage(cleanCell, dstLeft, dstTop, dstW, dstH);

                            // Also draw into masterSheet at (c * 128, r * 128)
                            float sheetDstLeft = c * targetCellSize + dstLeft;
                            float sheetDstTop = r * targetCellSize + dstTop;
                            gMaster.DrawImage(cleanCell, sheetDstLeft, sheetDstTop, dstW, dstH);
                        }

                        string framePath = Path.Combine(outputFramesDir, string.Format("soldier_{0}_{1}.png", rowNames[r], c + 1));
                        singleFrame.Save(framePath, ImageFormat.Png);
                        singleFrame.Dispose();
                        cleanCell.Dispose();
                    }
                }
            }

            masterSheet.Save(outputSheetPath, ImageFormat.Png);
            masterSheet.Dispose();
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies "System.Drawing.dll"
$raw = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\assets\sprites\soldier_spritesheet_raw.jpg"))
$sheetOut = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\assets\sprites\soldier_spritesheet.png"))
$framesDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\assets\sprites\frames"))

[SmoothSpriteProcessor]::Process($raw, $sheetOut, $framesDir)

Write-Host "Smooth anchor-aligned spritesheet successfully generated!"
