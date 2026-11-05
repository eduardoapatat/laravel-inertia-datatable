<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

use Illuminate\Console\Command;
use Symfony\Component\Console\Attribute\AsCommand;

#[AsCommand(name: 'inertia-datatable:ui')]
class UiCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'inertia-datatable:ui
        {--update : Overwrite the data table files with the latest version from the registry}
        {--force : Do not ask for confirmation before updating}';

    /**
     * @var string
     */
    protected $description = 'Install or update the React UI of the data table';

    public function handle(UiInstaller $installer): int
    {
        if ($this->option('update')) {
            return $this->update($installer);
        }

        if ($installer->isInstalled()) {
            $this->components->info('The data table UI is already installed. Use --update to get the latest version.');

            return self::SUCCESS;
        }

        return $this->runInstaller($installer, $installer->installCommand());
    }

    private function update(UiInstaller $installer): int
    {
        $this->components->warn('This overwrites components/data-table/*, components/ui/faceted.tsx, hooks/use-server-data-table.ts and lib/data-table-*.ts. Local changes in those files will be lost; other components/ui files are not touched.');

        if (! $this->option('force') && ! $this->confirm('Update the data table UI?')) {
            $this->components->info('Update cancelled.');

            return self::FAILURE;
        }

        return $this->runInstaller($installer, $installer->updateCommand());
    }

    /**
     * @param  list<string>  $command
     */
    private function runInstaller(UiInstaller $installer, array $command): int
    {
        $this->components->info('Running: '.implode(' ', $command));

        if (! $installer->run($command, fn (string $type, string $output) => $this->output->write($output))) {
            $this->components->error('The data table UI could not be installed. Run the command above manually.');

            return self::FAILURE;
        }

        $this->components->info('The data table UI is ready.');

        return self::SUCCESS;
    }
}
