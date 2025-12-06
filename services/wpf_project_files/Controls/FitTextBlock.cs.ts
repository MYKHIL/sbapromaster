
export const content = `
using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace SBAProMaster.WPF.Controls;

/// <summary>
/// A TextBlock that automatically adjusts its FontSize to fit its content within its bounds without wrapping.
/// </summary>
public class FitTextBlock : TextBlock
{
    public static readonly DependencyProperty MinFontSizeProperty =
        DependencyProperty.Register(nameof(MinFontSize), typeof(double), typeof(FitTextBlock), new PropertyMetadata(8.0, OnFormattedTextInvalidated));

    public double MinFontSize
    {
        get => (double)GetValue(MinFontSizeProperty);
        set => SetValue(MinFontSizeProperty, value);
    }

    private bool _isUpdating;

    public FitTextBlock()
    {
        // Adjust font size when the control's size changes.
        this.SizeChanged += OnSizeChanged;

        // Use DependencyPropertyDescriptor to listen for changes to the Text property.
        var dpd = DependencyPropertyDescriptor.FromProperty(TextProperty, typeof(TextBlock));
        if (dpd != null)
        {
            dpd.AddValueChanged(this, (s, e) => AdjustFontSize());
        }
    }

    private static void OnFormattedTextInvalidated(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is FitTextBlock ftb)
        {
            ftb.AdjustFontSize();
        }
    }

    private void OnSizeChanged(object sender, SizeChangedEventArgs e)
    {
        // Only trigger on width changes to avoid potential infinite loops with height changes.
        if (e.WidthChanged)
        {
            AdjustFontSize();
        }
    }

    private void AdjustFontSize()
    {
        if (_isUpdating || ActualWidth == 0 || !IsMeasureValid) return;

        _isUpdating = true;

        try
        {
            var initialFontSize = GetValue(FontSizeProperty) as double? ?? 14.0;
            SetValue(FontSizeProperty, initialFontSize); // Reset to max size before calculating

            var typeface = new Typeface(FontFamily, FontStyle, FontWeight, FontStretch);
            var currentFontSize = initialFontSize;

            // Check for overflow
            while (currentFontSize > MinFontSize)
            {
#pragma warning disable CS0618
                var formattedText = new FormattedText(
                    Text,
                    System.Globalization.CultureInfo.CurrentCulture,
                    FlowDirection,
                    typeface,
                    currentFontSize,
                    Foreground,
                    VisualTreeHelper.GetDpi(this).PixelsPerDip);
#pragma warning restore CS0618

                // Allow for a small buffer to prevent floating point inaccuracies
                if (formattedText.Width <= ActualWidth)
                {
                    break;
                }

                currentFontSize -= 0.5;
            }

            // Set the final calculated font size
            SetValue(FontSizeProperty, currentFontSize);
        }
        finally
        {
            _isUpdating = false;
        }
    }
}
`;