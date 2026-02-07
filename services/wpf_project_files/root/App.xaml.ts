
export const content = `
<Application x:Class="SBAProMaster.WPF.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
             mc:Ignorable="d"
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             xmlns:localConverters="clr-namespace:SBAProMaster.WPF.Converters">
    <Application.Resources>
        <ResourceDictionary>
            <ResourceDictionary.MergedDictionaries>
                <materialDesign:BundledTheme BaseTheme="Light" PrimaryColor="Blue" SecondaryColor="Indigo" />
                <ResourceDictionary Source="pack://application:,,,/Styles/CustomTheme.xaml" />
            </ResourceDictionary.MergedDictionaries>

            <!-- Converters used throughout the application -->
            <BooleanToVisibilityConverter x:Key="BooleanToVisibilityConverter" />
            <localConverters:InverseBooleanConverter x:Key="InverseBooleanConverter" />

        </ResourceDictionary>
    </Application.Resources>
</Application>
`;