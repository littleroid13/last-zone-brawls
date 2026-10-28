$source = @"
using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;

public class AlignmentAnalyzer
{
    public static void Run(string inputPath)
    {
        using (Bitmap src = new Bitmap(inputPath))
        {
            int[] rowTops = new int[] { 118, 283, 450, 620 };
            int[] rowBottoms = new int[] { 241, 411, 578, 747 };
            int[] colLefts = new int[] { 54, 285, 514, 740 };
            int[] colRights = new int[] { 280, 509, 734, 969 };
            string[] rowNames = new string[] { "idle", "walk", "attack", "hurt" };

            Func<Color, bool> isBg = (col) =>
            {
                if (col.R > 195 && col.G > 195 && col.B > 195)
                {
                    int dRG = Math.Abs(col.R - col.G);
                    int dGB = Math.Abs(col.G - col.B);
                    int dRB = Math.Abs(col.R - col.B);
                    if (dRG <= 12 && dGB <= 12 && dRB <= 12) return true;
                }
                if (col.R >= 135 && col.R <= 175 && Math.Abs(col.R - col.G) <= 6 && Math.Abs(col.G - col.B) <= 6)
                    return true;
                return false;
            };

            for (int r = 0; r < 4; r++)
            {
                int top = rowTops[r];
                int btm = rowBottoms[r];
                for (int c = 0; c < 4; c++)
                {
                    int left = colLefts[c];
                    int right = colRights[c];

                    int minX = 9999, maxX = -1, minY = 9999, maxY = -1;
                    long sumX = 0, sumY = 0, count = 0;

                    for (int y = top; y <= btm; y++)
                    {
                        for (int x = left; x <= right; x++)
                        {
                            Color p = src.GetPixel(x, y);
                            if (!isBg(p))
                            {
                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (y < minY) minY = y;
                                if (y > maxY) maxY = y;
                                sumX += x;
                                sumY += y;
                                count++;
                            }
                        }
                    }

                    int cellCenterX = left + (right - left) / 2;
                    double comX = count > 0 ? (double)sumX / count : 0;
                    double comY = count > 0 ? (double)sumY / count : 0;
                    int w = maxX - minX + 1;
                    int h = maxY - minY + 1;

                    Console.WriteLine(string.Format("{0,-7} F{1}: X=[{2}..{3}] (w={4}), Y=[{5}..{6}] (h={7}), CoM=({8:F1},{9:F1}), CellCenter={10}",
                        rowNames[r], c + 1, minX - left, maxX - left, w, minY - top, maxY - top, h, comX - left, comY - top, cellCenterX - left));
                }
            }
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies "System.Drawing.dll"
$raw = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\assets\sprites\soldier_spritesheet_raw.jpg"))
[AlignmentAnalyzer]::Run($raw)
