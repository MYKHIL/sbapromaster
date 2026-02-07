
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Views.SettingsView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008" 
             xmlns:viewmodels="clr-namespace:SBAProMaster.WPF.ViewModels"
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             mc:Ignorable="d" 
             d:DataContext="{d:DesignInstance Type=viewmodels:SettingsViewModel, IsDesignTimeCreatable=True}"
             d:DesignHeight="700" d:DesignWidth="1000">
    <ScrollViewer VerticalScrollBarVisibility="Auto">
        <StackPanel MaxWidth="800">
            <TextBlock Text="School Setup" Style="{StaticResource MaterialDesignHeadline4TextBlock}" Margin="0,0,0,24" />

            <materialDesign:Card Padding="32" UniformCornerRadius="12">
                <StackPanel>
                    <!-- School Information -->
                    <Border BorderBrush="{StaticResource BorderBrush}" BorderThickness="0,0,0,1" Padding="0,0,0,8" Margin="0,0,0,16">
                        <TextBlock Text="School Information" Style="{StaticResource MaterialDesignHeadline6TextBlock}"/>
                    </Border>
                    <Grid>
                        <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="24"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                        <TextBox Grid.Column="0" materialDesign:HintAssist.Hint="School Name" Text="{Binding Settings.SchoolName}" Style="{StaticResource MaterialDesignOutlinedTextBox}" />
                        <TextBox Grid.Column="2" materialDesign:HintAssist.Hint="District" Text="{Binding Settings.District}" Style="{StaticResource MaterialDesignOutlinedTextBox}" />
                    </Grid>
                    <TextBox materialDesign:HintAssist.Hint="Address" Text="{Binding Settings.Address}" Style="{StaticResource MaterialDesignOutlinedTextBox}" TextWrapping="Wrap" AcceptsReturn="True" VerticalScrollBarVisibility="Auto" Height="80" Margin="0,16,0,0"/>

                    <Grid Margin="0,16,0,0">
                        <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="24"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                        <TextBox Grid.Column="0" materialDesign:HintAssist.Hint="Academic Year" Text="{Binding Settings.AcademicYear}" Style="{StaticResource MaterialDesignOutlinedTextBox}" />
                        <TextBox Grid.Column="2" materialDesign:HintAssist.Hint="Academic Term" Text="{Binding Settings.AcademicTerm}" Style="{StaticResource MaterialDesignOutlinedTextBox}" />
                    </Grid>

                     <Grid Margin="0,16,0,0">
                        <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="24"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                        <DatePicker Grid.Column="0" materialDesign:HintAssist.Hint="Vacation Date" Text="{Binding Settings.VacationDate}" Style="{StaticResource MaterialDesignOutlinedDatePicker}" />
                        <DatePicker Grid.Column="2" materialDesign:HintAssist.Hint="Reopening Date" Text="{Binding Settings.ReopeningDate}" Style="{StaticResource MaterialDesignOutlinedDatePicker}" />
                    </Grid>
                    
                    <!-- Separator -->
                    <Separator Margin="0,24" />

                    <!-- Branding & Signatures -->
                    <Border BorderBrush="{StaticResource BorderBrush}" BorderThickness="0,0,0,1" Padding="0,0,0,8" Margin="0,0,0,16">
                        <TextBlock Text="Branding &amp; Signatures" Style="{StaticResource MaterialDesignHeadline6TextBlock}"/>
                    </Border>
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                        </Grid.RowDefinitions>
                        <Grid.ColumnDefinitions>
                            <ColumnDefinition Width="*"/>
                            <ColumnDefinition Width="24"/>
                            <ColumnDefinition Width="*"/>
                        </Grid.ColumnDefinitions>

                        <TextBox Grid.Row="0" Grid.Column="0" materialDesign:HintAssist.Hint="Headmaster's Name" Text="{Binding Settings.HeadmasterName}" Style="{StaticResource MaterialDesignOutlinedTextBox}" />

                        <!-- School Logo -->
                        <StackPanel Grid.Row="1" Grid.Column="0" Margin="0,24,0,0">
                            <TextBlock Text="School Logo" Style="{StaticResource MaterialDesignSubtitle2TextBlock}" Margin="0,0,0,8"/>
                             <Grid>
                                <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                                <Border Grid.Column="0" BorderBrush="{StaticResource BorderBrush}" BorderThickness="1" CornerRadius="4" Padding="2" Background="#F9FAFB" Width="128" Height="128">
                                    <Image Source="{Binding Settings.Logo}" Stretch="Uniform" />
                                </Border>
                                <StackPanel Grid.Column="1" Margin="16,0,0,0" VerticalAlignment="Center">
                                     <Button Content="Upload Image" Style="{StaticResource MaterialDesignOutlinedButton}" Margin="0,0,0,4" Command="{Binding SelectLogoFileCommand}"/>
                                     <Button Content="✨ Enhance Image" Style="{StaticResource MaterialDesignFlatButton}" Foreground="Indigo" Command="{Binding EnhanceLogoCommand}"/>
                                </StackPanel>
                            </Grid>
                        </StackPanel>

                        <!-- Headmaster Signature -->
                        <StackPanel Grid.Row="1" Grid.Column="2" Margin="0,24,0,0">
                             <TextBlock Text="Headmaster's Signature" Style="{StaticResource MaterialDesignSubtitle2TextBlock}" Margin="0,0,0,8"/>
                             <Grid>
                                <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                                <Border Grid.Column="0" BorderBrush="{StaticResource BorderBrush}" BorderThickness="1" CornerRadius="4" Padding="2" Background="#F9FAFB" Width="144" Height="48">
                                    <Image Source="{Binding Settings.HeadmasterSignature}" Stretch="Uniform" />
                                </Border>
                                <StackPanel Grid.Column="1" Margin="16,0,0,0" VerticalAlignment="Center">
                                     <Button Content="Upload Image" Style="{StaticResource MaterialDesignOutlinedButton}" Margin="0,0,0,4" Command="{Binding SelectSignatureFileCommand}"/>
                                     <Button Content="✨ Enhance Image" Style="{StaticResource MaterialDesignFlatButton}" Foreground="Indigo" Command="{Binding EnhanceSignatureCommand}"/>
                                </StackPanel>
                            </Grid>
                        </StackPanel>
                    </Grid>
                </StackPanel>
            </materialDesign:Card>
        </StackPanel>
    </ScrollViewer>
</UserControl>
`;
