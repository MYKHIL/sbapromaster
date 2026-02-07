
export const content = `
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    
    <!-- Color Palette -->
    <Color x:Key="PrimaryBlueColor">#2563EB</Color>
    <Color x:Key="BackgroundGrayColor">#F9FAFB</Color>
    <Color x:Key="SurfaceWhiteColor">#FFFFFF</Color>
    <Color x:Key="PrimaryTextColor">#1F2937</Color>
    <Color x:Key="SecondaryTextColor">#4B5563</Color>
    <Color x:Key="BorderColor">#E5E7EB</Color>
    <Color x:Key="DangerRedColor">#DC2626</Color>

    <!-- Brushes -->
    <SolidColorBrush x:Key="PrimaryBlueBrush" Color="{StaticResource PrimaryBlueColor}" />
    <SolidColorBrush x:Key="BackgroundGrayBrush" Color="{StaticResource BackgroundGrayColor}" />
    <SolidColorBrush x:Key="SurfaceWhiteBrush" Color="{StaticResource SurfaceWhiteColor}" />
    <SolidColorBrush x:Key="PrimaryTextBrush" Color="{StaticResource PrimaryTextColor}" />
    <SolidColorBrush x:Key="SecondaryTextBrush" Color="{StaticResource SecondaryTextColor}" />
    <SolidColorBrush x:Key="BorderBrush" Color="{StaticResource BorderColor}" />
    <SolidColorBrush x:Key="DangerRedBrush" Color="{StaticResource DangerRedColor}" />

    <!-- Typography -->
    <Style TargetType="TextBlock">
        <Setter Property="FontFamily" Value="Segoe UI" />
        <Setter Property="Foreground" Value="{StaticResource PrimaryTextBrush}" />
        <Setter Property="TextTrimming" Value="CharacterEllipsis" />
    </Style>
    
    <Style TargetType="Button" BasedOn="{StaticResource MaterialDesignRaisedButton}">
        <Setter Property="Background" Value="{StaticResource PrimaryBlueBrush}" />
        <Setter Property="Foreground" Value="White" />
    </Style>

</ResourceDictionary>
`;
