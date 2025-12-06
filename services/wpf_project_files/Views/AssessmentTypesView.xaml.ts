
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Views.AssessmentTypesView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008" 
             xmlns:viewmodels="clr-namespace:SBAProMaster.WPF.ViewModels"
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             mc:Ignorable="d" 
             d:DataContext="{d:DesignInstance Type=viewmodels:AssessmentTypesViewModel, IsDesignTimeCreatable=True}"
             d:DesignHeight="700" d:DesignWidth="1000">
    <materialDesign:DialogHost IsOpen="{Binding IsModalOpen}"
                               CloseOnClickAway="True"
                               DialogContent="{Binding}">
        <materialDesign:DialogHost.DialogContentTemplate>
            <DataTemplate DataType="{x:Type viewmodels:AssessmentTypesViewModel}">
                <StackPanel Margin="16" MinWidth="300">
                    <TextBlock Text="Add/Edit Assessment" Style="{StaticResource MaterialDesignHeadline6TextBlock}" Margin="0,0,0,16"/>
                    
                    <TextBox materialDesign:HintAssist.Hint="Assessment Name"
                             Text="{Binding SelectedAssessment.Name, UpdateSourceTrigger=PropertyChanged}"
                             Margin="0,8"/>

                    <TextBox materialDesign:HintAssist.Hint="Weight (%)"
                             Text="{Binding SelectedAssessment.Weight, UpdateSourceTrigger=PropertyChanged}"
                             Margin="0,8"/>

                    <StackPanel Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,16,0,0">
                        <Button Content="Cancel" Command="{Binding CloseModalCommand}" Style="{StaticResource MaterialDesignTextButton}" Margin="0,0,8,0"/>
                        <Button Content="Save" Command="{Binding SaveAssessmentCommand}" />
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

            <TextBlock Grid.Row="0" Text="Manage Assessment Types" Style="{StaticResource MaterialDesignHeadline4TextBlock}" Margin="0,0,0,16" />
            
            <DockPanel Grid.Row="1" LastChildFill="False">
                <Button DockPanel.Dock="Right" Command="{Binding OpenAddModalCommand}"
                        Style="{StaticResource MaterialDesignRaisedButton}"
                        materialDesign:ButtonAssist.CornerRadius="8"
                        VerticalAlignment="Center">
                    <StackPanel Orientation="Horizontal">
                        <materialDesign:PackIcon Kind="Add" Margin="-4,0,8,0" />
                        <TextBlock Text="Add New Assessment" />
                    </StackPanel>
                </Button>
                
                 <Border BorderThickness="1" BorderBrush="#FBBF24" Background="#FEF9C3" CornerRadius="8" Padding="16">
                     <TextBlock Foreground="#B45309" TextWrapping="Wrap">
                         <Run FontWeight="Bold">Total Weight: 100%.</Run>
                         <Run>It is recommended that the sum of all assessment weights equals 100%.</Run>
                     </TextBlock>
                </Border>
            </DockPanel>


            <materialDesign:Card Grid.Row="2" Margin="0,16,0,0" Padding="0" UniformCornerRadius="12">
                <materialDesign:Card.Effect>
                    <DropShadowEffect ShadowDepth="2" Color="Black" Opacity="0.2" BlurRadius="5" />
                </materialDesign:Card.Effect>
                <DataGrid ItemsSource="{Binding Assessments}"
                          AutoGenerateColumns="False" CanUserAddRows="False" IsReadOnly="True"
                          Style="{StaticResource MaterialDesignDataGrid}">
                    <DataGrid.Columns>
                        <DataGridTextColumn Header="Assessment Name" Binding="{Binding Name}" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}" />
                        <DataGridTextColumn Header="Weight (%)" Binding="{Binding Weight, StringFormat={}{0}%}" Width="Auto" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}" />
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