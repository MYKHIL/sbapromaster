
export const content = `
<UserControl x:Class="SBAProMaster.WPF.Views.SubjectsView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008" 
             xmlns:viewmodels="clr-namespace:SBAProMaster.WPF.ViewModels"
             xmlns:materialDesign="http://materialdesigninxaml.net/winfx/xaml/themes"
             mc:Ignorable="d" 
             d:DataContext="{d:DesignInstance Type=viewmodels:SubjectsViewModel, IsDesignTimeCreatable=True}"
             d:DesignHeight="700" d:DesignWidth="1000">

    <materialDesign:DialogHost IsOpen="{Binding IsModalOpen}"
                               CloseOnClickAway="True"
                               DialogContent="{Binding}">
        <materialDesign:DialogHost.DialogContentTemplate>
            <DataTemplate DataType="{x:Type viewmodels:SubjectsViewModel}">
                <StackPanel Margin="16" MinWidth="300">
                    <TextBlock Text="Add/Edit Subject" Style="{StaticResource MaterialDesignHeadline6TextBlock}" Margin="0,0,0,16"/>
                    
                    <TextBox materialDesign:HintAssist.Hint="Subject Name"
                             Text="{Binding SelectedSubject.Name, UpdateSourceTrigger=PropertyChanged}"
                             Margin="0,8"/>

                    <ComboBox materialDesign:HintAssist.Hint="Type"
                              SelectedItem="{Binding SelectedSubject.Type}"
                              Margin="0,8">
                        <ComboBoxItem>Core</ComboBoxItem>
                        <ComboBoxItem>Elective</ComboBoxItem>
                    </ComboBox>

                    <StackPanel Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,16,0,0">
                        <Button Content="Cancel" Command="{Binding CloseModalCommand}" Style="{StaticResource MaterialDesignTextButton}" Margin="0,0,8,0"/>
                        <Button Content="Save" Command="{Binding SaveSubjectCommand}" />
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

            <TextBlock Grid.Row="0" Text="Manage Subjects" Style="{StaticResource MaterialDesignHeadline4TextBlock}" Margin="0,0,0,16" />
            
            <DockPanel Grid.Row="1" LastChildFill="False">
                <Button DockPanel.Dock="Right" Command="{Binding OpenAddModalCommand}"
                        Style="{StaticResource MaterialDesignRaisedButton}"
                        materialDesign:ButtonAssist.CornerRadius="8"
                        VerticalAlignment="Center">
                    <StackPanel Orientation="Horizontal">
                        <materialDesign:PackIcon Kind="Add" Margin="-4,0,8,0" />
                        <TextBlock Text="Add New Subject" />
                    </StackPanel>
                </Button>

                <TextBox DockPanel.Dock="Left"
                         Text="{Binding SearchQuery, UpdateSourceTrigger=PropertyChanged}"
                         materialDesign:HintAssist.Hint="Search by subject or type..."
                         materialDesign:TextFieldAssist.HasLeadingIcon="True"
                         materialDesign:TextFieldAssist.LeadingIcon="Search"
                         Style="{StaticResource MaterialDesignOutlinedTextBox}"
                         Width="300" />
            </DockPanel>

            <materialDesign:Card Grid.Row="2" Margin="0,16,0,0" Padding="0" UniformCornerRadius="12">
                <materialDesign:Card.Effect>
                    <DropShadowEffect ShadowDepth="2" Color="Black" Opacity="0.2" BlurRadius="5" />
                </materialDesign:Card.Effect>
                <DataGrid ItemsSource="{Binding Subjects}"
                          AutoGenerateColumns="False" CanUserAddRows="False" IsReadOnly="True"
                          Style="{StaticResource MaterialDesignDataGrid}">
                    <DataGrid.Columns>
                        <DataGridTextColumn Header="Subject Name" Binding="{Binding Name}" FontWeight="SemiBold" Width="*" ElementStyle="{StaticResource MaterialDesignDataGridTextColumnStyle}" />
                        
                        <DataGridTemplateColumn Header="Type" Width="Auto">
                            <DataGridTemplateColumn.CellTemplate>
                                <DataTemplate>
                                    <Border CornerRadius="12" Padding="8,4" Margin="4">
                                        <Border.Style>
                                            <Style TargetType="Border">
                                                <Setter Property="Background" Value="#DCFCE7"/>
                                                <Style.Triggers>
                                                    <DataTrigger Binding="{Binding Type}" Value="Elective">
                                                        <Setter Property="Background" Value="#FEF3C7"/>
                                                    </DataTrigger>
                                                </Style.Triggers>
                                            </Style>
                                        </Border.Style>
                                        <TextBlock Text="{Binding Type}" FontSize="12" FontWeight="Medium">
                                             <TextBlock.Style>
                                                <Style TargetType="TextBlock">
                                                    <Setter Property="Foreground" Value="#166534"/>
                                                    <Style.Triggers>
                                                        <DataTrigger Binding="{Binding Type}" Value="Elective">
                                                            <Setter Property="Foreground" Value="#92400E"/>
                                                        </DataTrigger>
                                                    </Style.Triggers>
                                                </Style>
                                            </TextBlock.Style>
                                        </TextBlock>
                                    </Border>
                                </DataTemplate>
                            </DataGridTemplateColumn.CellTemplate>
                        </DataGridTemplateColumn>

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