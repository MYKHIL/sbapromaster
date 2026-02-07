
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Views.ClassesView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008" 
             xmlns:viewmodels="clr-namespace:SBAProMaster.WPF.ViewModels"
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             mc:Ignorable="d" 
             d:DataContext="{d:DesignInstance Type=viewmodels:ClassesViewModel, IsDesignTimeCreatable=True}"
             d:DesignHeight="700" d:DesignWidth="1000">
    <materialDesign:DialogHost IsOpen="{Binding IsModalOpen}"
                               CloseOnClickAway="True"
                               DialogContent="{Binding}">
        <materialDesign:DialogHost.DialogContentTemplate>
            <DataTemplate DataType="{x:Type viewmodels:ClassesViewModel}">
                <StackPanel Margin="16" MinWidth="400">
                    <TextBlock Text="Add/Edit Class" Style="{StaticResource MaterialDesignHeadline6TextBlock}" Margin="0,0,0,16"/>
                    
                    <TextBox materialDesign:HintAssist.Hint="Class Name"
                             Text="{Binding SelectedClass.Name, UpdateSourceTrigger=PropertyChanged}"
                             Margin="0,8"/>

                    <TextBox materialDesign:HintAssist.Hint="Class Teacher's Name"
                             Text="{Binding SelectedClass.TeacherName, UpdateSourceTrigger=PropertyChanged}"
                             Margin="0,8"/>
                    
                    <TextBlock Text="Teacher's Signature" Style="{StaticResource MaterialDesignSubtitle2TextBlock}" Margin="0,16,0,8"/>
                    <Grid>
                        <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                        <Border Grid.Column="0" BorderBrush="{StaticResource BorderBrush}" BorderThickness="1" CornerRadius="4" Padding="2" Background="#F9FAFB" Width="144" Height="48">
                            <Image Source="{Binding SelectedClass.TeacherSignature}" Stretch="Uniform" />
                        </Border>
                        <StackPanel Grid.Column="1" Margin="16,0,0,0" VerticalAlignment="Center">
                             <Button Content="Upload Image" Style="{StaticResource MaterialDesignOutlinedButton}" Margin="0,0,0,4"/>
                             <Button Content="✨ Enhance Image" Style="{StaticResource MaterialDesignFlatButton}" Foreground="Indigo"/>
                        </StackPanel>
                    </Grid>

                    <StackPanel Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,16,0,0">
                        <Button Content="Cancel" Command="{Binding CloseModalCommand}" Style="{StaticResource MaterialDesignTextButton}" Margin="0,0,8,0"/>
                        <Button Content="Save" Command="{Binding SaveClassCommand}" />
                    </StackPanel>
                </StackPanel>
            </DataTemplate>
        </materialDesign:DialogHost.DialogContentTemplate>

        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto" />
                <RowDefinition Height="Auto" />
                <RowDefinition Height="*" />
            </Grid.RowDefinitions>

            <TextBlock Grid.Row="0" Text="Manage Classes" Style="{StaticResource MaterialDesignHeadline4TextBlock}" Margin="0,0,0,16" />
            
            <DockPanel Grid.Row="1" LastChildFill="False">
                <Button DockPanel.Dock="Right" Command="{Binding OpenAddModalCommand}"
                        Style="{StaticResource MaterialDesignRaisedButton}"
                        materialDesign:ButtonAssist.CornerRadius="8"
                        VerticalAlignment="Center">
                    <StackPanel Orientation="Horizontal">
                        <materialDesign:PackIcon Kind="Add" Margin="-4,0,8,0" />
                        <TextBlock Text="Add New Class" />
                    </StackPanel>
                </Button>

                <TextBox DockPanel.Dock="Left"
                         Text="{Binding SearchQuery, UpdateSourceTrigger=PropertyChanged}"
                         materialDesign:HintAssist.Hint="Search by class or teacher name..."
                         materialDesign:TextFieldAssist.HasLeadingIcon="True"
                         materialDesign:TextFieldAssist.LeadingIcon="Search"
                         Style="{StaticResource MaterialDesignOutlinedTextBox}"
                         Width="300" />
            </DockPanel>

            <materialDesign:Card Grid.Row="2" Margin="0,16,0,0" Padding="0" UniformCornerRadius="12">
                <materialDesign:Card.Effect>
                    <DropShadowEffect ShadowDepth="2" Color="Black" Opacity="0.2" BlurRadius="5" />
                </materialDesign:Card.Effect>
                <DataGrid ItemsSource="{Binding Classes}"
                          AutoGenerateColumns="False" CanUserAddRows="False" IsReadOnly="True"
                          Style="{StaticResource MaterialDesignDataGrid}">
                    <DataGrid.Columns>
                        <DataGridTextColumn Header="Class Name" Binding="{Binding Name}" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}" />
                        <DataGridTextColumn Header="Class Teacher" Binding="{Binding TeacherName}" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}" />
                        
                        <DataGridTemplateColumn Header="Actions" Width="Auto">
                            <DataGridTemplateColumn.CellTemplate>
                                <DataTemplate>
                                    <StackPanel Orientation="Horizontal">
                                        <Button Style="{StaticResource MaterialDesignIconButton}"
                                                Command="{Binding DataContext.OpenEditModalCommand, RelativeSource={RelativeSource AncestorType=DataGrid}}"
                                                CommandParameter="{Binding}"
                                                ToolTip="Edit">
                                            <materialDesign:PackIcon Kind="Pencil" Foreground="{StaticResource PrimaryBlueBrush}"/>
                                        </Button>
                                        <Button Style="{StaticResource MaterialDesignIconButton}" ToolTip="Delete">
                                            <materialDesign:PackIcon Kind="Delete" Foreground="{StaticResource DangerRedBrush}" />
                                        </Button>
                                    </StackPanel>
                                </DataTemplate>
                            </DataGridTemplateColumn.CellTemplate>
                        </DataGridTemplateColumn>
                    </DataGrid.Columns>
                </DataGrid>
            </materialDesign:Card>
        </Grid>
    </materialDesign:DialogHost>
</UserControl>
`;