$source = @"
using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;

public class SpriteProcessor
{
    public static void Process(string inputPath, string outputSheetPath, string outputFramesDir)
    {
        using (Bitmap src = new Bitmap(inputPath))
        {
            int w = src.Width;
            int h = src.Height;

            // Row inner y bounds (excluding border lines)
            // HLines were: 115, 243, 280, 413, 447, 580, 616, 749
            int[] rowTops = new int[] { 118, 283, 450, 620 };
            int[] rowBottoms = new int[] { 241, 411, 578, 747 };

            // Col inner x bounds (excluding border lines)
            // VLines were: 51, 282, 511, 737, 972
            int[] colLefts = new int[] { 54, 285, 514, 740 };
            int[] colRights = new int[] { 280, 509, 734, 969 };

            string[] rowNames = new string[] { "idle", "walk", "attack", "hurt" };

            Directory.CreateDirectory(outputFramesDir);

            // Output uniform sprite sheet: 4 rows x 4 cols, each cell 128x128
            int targetCellSize = 128;
            Bitmap masterSheet = new Bitmap(targetCellSize * 4, targetCellSize * 4, PixelFormat.Format32bppArgb);
            using (Graphics gMaster = Graphics.FromImage(masterSheet))
            {
                gMaster.Clear(Color.Transparent);
                gMaster.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                gMaster.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;

                for (int r = 0; r < 4; r++)
                {
                    int top = rowTops[r];
                    int btm = rowBottoms[r];
                    int cellH = btm - top + 1;

                    for (int c = 0; c < 4; c++)
                    {
                        int left = colLefts[c];
                        int right = colRights[c];
                        int cellW = right - left + 1;

                        // Crop raw cell
                        Bitmap cellBmp = new Bitmap(cellW, cellH, PixelFormat.Format32bppArgb);
                        for (int y = 0; y < cellH; y++)
                        {
                            for (int x = 0; x < cellW; x++)
                            {
                                Color p = src.GetPixel(left + x, top + y);
                                cellBmp.SetPixel(x, y, p);
                            }
                        }

                        // Remove checkerboard background using Flood Fill from outer edges
                        bool[,] isBg = new bool[cellW, cellH];
                        Queue<Point> q = new Queue<Point>();

                        // Predicate for background
                        Func<Color, bool> matchesBg = (col) =>
                        {
                            // If pixel is checkerboard grey/white (neutral, high brightness)
                            if (col.R > 195 && col.G > 195 && col.B > 195)
                            {
                                int dRG = Math.Abs(col.R - col.G);
                                int dGB = Math.Abs(col.G - col.B);
                                int dRB = Math.Abs(col.R - col.B);
                                if (dRG <= 12 && dGB <= 12 && dRB <= 12)
                                    return true;
                            }
                            // Also border grey remnants
                            if (col.R >= 135 && col.R <= 175 && Math.Abs(col.R - col.G) <= 6 && Math.Abs(col.G - col.B) <= 6)
                                return true;

                            return false;
                        };

                        // Seed border pixels
                        for (int x = 0; x < cellW; x++)
                        {
                            if (matchesBg(cellBmp.GetPixel(x, 0))) { isBg[x, 0] = true; q.Enqueue(new Point(x, 0)); }
                            if (matchesBg(cellBmp.GetPixel(x, cellH - 1))) { isBg[x, cellH - 1] = true; q.Enqueue(new Point(x, cellH - 1)); }
                        }
                        for (int y = 0; y < cellH; y++)
                        {
                            if (matchesBg(cellBmp.GetPixel(0, y))) { isBg[0, y] = true; q.Enqueue(new Point(0, y)); }
                            if (matchesBg(cellBmp.GetPixel(cellW - 1, y))) { isBg[cellW - 1, y] = true; q.Enqueue(new Point(cellW - 1, y)); }
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
                                if (nx >= 0 && nx < cellW && ny >= 0 && ny < cellH && !isBg[nx, ny])
                                {
                                    Color nCol = cellBmp.GetPixel(nx, ny);
                                    if (matchesBg(nCol))
                                    {
                                        isBg[nx, ny] = true;
                                        q.Enqueue(new Point(nx, ny));
                                    }
                                }
                            }
                        }

                        // Apply transparency
                        int minSoldierX = cellW, maxSoldierX = 0, minSoldierY = cellH, maxSoldierY = 0;
                        for (int y = 0; y < cellH; y++)
                        {
                            for (int x = 0; x < cellW; x++)
                            {
                                if (isBg[x, y])
                                {
                                    cellBmp.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                                }
                                else
                                {
                                    Color p = cellBmp.GetPixel(x, y);
                                    // Also check if any isolated background pixel was missed inside
                                    if (matchesBg(p))
                                    {
                                        cellBmp.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                                    }
                                    else
                                    {
                                        if (x < minSoldierX) minSoldierX = x;
                                        if (x > maxSoldierX) maxSoldierX = x;
                                        if (y < minSoldierY) minSoldierY = y;
                                        if (y > maxSoldierY) maxSoldierY = y;
                                    }
                                }
                            }
                        }

                        // Save individual frame
                        string framePath = Path.Combine(outputFramesDir, string.Format("soldier_{0}_{1}.png", rowNames[r], c + 1));
                        
                        // Extract soldier tightly and draw centered on 128x128
                        if (maxSoldierX >= minSoldierX && maxSoldierY >= minSoldierY)
                        {
                            int sW = maxSoldierX - minSoldierX + 1;
                            int sH = maxSoldierY - minSoldierY + 1;

                            Rectangle srcRect = new Rectangle(minSoldierX, minSoldierY, sW, sH);

                            // Maintain aspect ratio, fit inside targetCellSize with margins
                            float scale = Math.Min((targetCellSize - 18f) / sW, (targetCellSize - 18f) / sH);
                            int drawW = (int)(sW * scale);
                            int drawH = (int)(sH * scale);
                            int drawX = (targetCellSize - drawW) / 2;
                            int drawY = targetCellSize - drawH - 8; // Anchor near bottom so feet align!

                            // Individual frame bmp
                            Bitmap singleFrame = new Bitmap(targetCellSize, targetCellSize, PixelFormat.Format32bppArgb);
                            using (Graphics gf = Graphics.FromImage(singleFrame))
                            {
                                gf.Clear(Color.Transparent);
                                gf.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                                gf.DrawImage(cellBmp, new Rectangle(drawX, drawY, drawW, drawH), srcRect, GraphicsUnit.Pixel);
                            }
                            singleFrame.Save(framePath, ImageFormat.Png);
                            singleFrame.Dispose();

                            // Also draw into masterSheet at (c * targetCellSize, r * targetCellSize)
                            int dstX = c * targetCellSize + drawX;
                            int dstY = r * targetCellSize + drawY;
                            gMaster.DrawImage(cellBmp, new Rectangle(dstX, dstY, drawW, drawH), srcRect, GraphicsUnit.Pixel);
                        }

                        cellBmp.Dispose();
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

[SpriteProcessor]::Process($raw, $sheetOut, $framesDir)

Write-Host "Sprite sheet generated: $sheetOut"
Write-Host "Individual frames saved to: $framesDir"
