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
        {--force : Do not ask for confirmation before updating}
        {--react : Install the React UI (by default, the framework of the Inertia adapter in package.json)}
        {--vue : Install the Vue UI (by default, the framework of the Inertia adapter in package.json)}';

    /**
     * @var string
     */
    protected $description = 'Install or update the React or Vue UI of the data table';

    public function handle(UiInstaller $installer): int
    {
        $frontend = $this->frontend($installer);

        if ($frontend === null) {
            return self::FAILURE;
        }

        if ($this->option('update')) {
            return $this->update($installer, $frontend);
        }

        if ($installer->isInstalled($frontend)) {
            $this->components->info('The data table UI is already installed. Use --update to get the latest version.');

            return self::SUCCESS;
        }

        return $this->runInstaller($installer, $frontend, $installer->installCommand($frontend));
    }

    private function frontend(UiInstaller $installer): ?Frontend
    {
        if ($this->option('react') && $this->option('vue')) {
            $this->components->error('Use --react or --vue, not both.');

            return null;
        }

        return match (true) {
            (bool) $this->option('react') => Frontend::React,
            (bool) $this->option('vue') => Frontend::Vue,
            default => $installer->detectFrontend(),
        };
    }

    private function update(UiInstaller $installer, Frontend $frontend): int
    {
        $this->components->warn("This overwrites {$frontend->updatedFiles()}. Local changes in those files will be lost; other components/ui files are not touched.");

        if (! $this->option('force') && ! $this->confirm('Update the data table UI?')) {
            $this->components->info('Update cancelled.');

            return self::FAILURE;
        }

        $result = $this->runInstaller($installer, $frontend, $installer->updateCommand($frontend));

        if ($result === self::SUCCESS) {
            foreach ($installer->deleteObsoleteFiles($frontend) as $file) {
                $this->components->info("Deleted resources/js/{$file}: the new version no longer has it.");
            }
        }

        return $result;
    }

    /**
     * @param  list<string>  $command
     */
    private function runInstaller(UiInstaller $installer, Frontend $frontend, array $command): int
    {
        $this->components->info('Running: '.implode(' ', $command));

        if (! $installer->run($command, fn (string $type, string $output) => $this->output->write($output), $frontend)) {
            $this->components->error('The data table UI could not be installed. Run the command above manually.');

            return self::FAILURE;
        }

        $this->components->info("The {$frontend->label()} data table UI is ready.");

        return self::SUCCESS;
    }
}
