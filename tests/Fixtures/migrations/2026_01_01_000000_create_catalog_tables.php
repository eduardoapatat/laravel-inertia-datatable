<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained();
            $table->string('name');
            $table->string('sku')->nullable();
            $table->string('status');
            $table->unsignedInteger('price');
            $table->unsignedInteger('stock');
            $table->boolean('featured');
            $table->date('released_on');
            $table->timestamps();
        });

        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->string('email');
            $table->string('password');
            $table->rememberToken();
            $table->text('notes')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->timestamps();
        });
    }
};
