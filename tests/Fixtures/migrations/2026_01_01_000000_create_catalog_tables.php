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

        Schema::create('readings', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('amount', 10, 2);
            $table->decimal('total', 10, 2);
            $table->float('ratio');
            $table->boolean('active');
            $table->boolean('verified');
        });

        // Teams: base queries built from through / pivot relations, and a morphTo.
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->string('name');
        });

        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id');
            $table->string('name');
            $table->string('password');
        });

        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id');
            $table->string('title');
        });

        Schema::create('note_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('note_id');
            $table->string('body');
        });

        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->string('label');
        });

        Schema::create('member_tag', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id');
            $table->foreignId('tag_id');
            $table->string('secret');
        });

        Schema::create('comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id');
            $table->string('body');
            $table->morphs('commentable');
        });
    }
};
